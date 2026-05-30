// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { jwtVerify } from "jose";

vi.mock("server-only", () => ({}));

const { mockSet, mockGet, mockDelete } = vi.hoisted(() => ({
  mockSet: vi.fn(),
  mockGet: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({ set: mockSet, get: mockGet, delete: mockDelete })
  ),
}));

// JWT_SECRET is a module-level constant in auth.ts, computed at load time.
// Tests run against the default "development-secret-key".
import { createSession } from "@/lib/auth";

const DEFAULT_SECRET = new TextEncoder().encode("development-secret-key");

beforeEach(() => {
  vi.clearAllMocks();
});

async function capturedToken(): Promise<string> {
  return mockSet.mock.calls[0][1] as string;
}

async function capturedOptions(): Promise<Record<string, unknown>> {
  return mockSet.mock.calls[0][2] as Record<string, unknown>;
}

describe("createSession", () => {
  test("sets the auth-token cookie", async () => {
    await createSession("user-1", "user@example.com");

    expect(mockSet).toHaveBeenCalledOnce();
    expect(mockSet.mock.calls[0][0]).toBe("auth-token");
  });

  test("JWT payload contains the correct userId and email", async () => {
    await createSession("user-abc", "hello@test.com");

    const { payload } = await jwtVerify(await capturedToken(), DEFAULT_SECRET);

    expect(payload.userId).toBe("user-abc");
    expect(payload.email).toBe("hello@test.com");
  });

  test("JWT is signed with HS256", async () => {
    await createSession("user-1", "user@example.com");

    const token = await capturedToken();
    const header = JSON.parse(atob(token.split(".")[0]));

    expect(header.alg).toBe("HS256");
  });

  test("JWT has an iat (issued-at) claim", async () => {
    const before = Math.floor(Date.now() / 1000);
    await createSession("user-1", "user@example.com");
    const after = Math.floor(Date.now() / 1000);

    const { payload } = await jwtVerify(await capturedToken(), DEFAULT_SECRET);

    expect(payload.iat).toBeGreaterThanOrEqual(before);
    expect(payload.iat).toBeLessThanOrEqual(after);
  });

  test("cookie expires approximately 7 days from now", async () => {
    const before = Date.now();
    await createSession("user-1", "user@example.com");
    const after = Date.now();

    const opts = await capturedOptions();
    const expiresAt = opts.expires as Date;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });

  test("cookie is set with httpOnly=true", async () => {
    await createSession("user-1", "user@example.com");

    expect((await capturedOptions()).httpOnly).toBe(true);
  });

  test("cookie is set with sameSite=lax", async () => {
    await createSession("user-1", "user@example.com");

    expect((await capturedOptions()).sameSite).toBe("lax");
  });

  test("cookie path is /", async () => {
    await createSession("user-1", "user@example.com");

    expect((await capturedOptions()).path).toBe("/");
  });

  test("secure=false outside production", async () => {
    // vitest sets NODE_ENV=test by default
    await createSession("user-1", "user@example.com");

    expect((await capturedOptions()).secure).toBe(false);
  });

  test("secure=true in production environment", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await createSession("user-1", "user@example.com");

    expect((await capturedOptions()).secure).toBe(true);
    vi.unstubAllEnvs();
  });

  test("token is a valid compact JWT (three dot-separated segments)", async () => {
    await createSession("user-1", "user@example.com");

    const token = await capturedToken();
    const parts = token.split(".");

    expect(parts).toHaveLength(3);
  });

  test("produces different tokens on successive calls", async () => {
    await createSession("user-1", "user@example.com");
    const token1 = await capturedToken();

    vi.clearAllMocks();
    await new Promise((r) => setTimeout(r, 1100)); // ensure different iat
    await createSession("user-1", "user@example.com");
    const token2 = await capturedToken();

    expect(token1).not.toBe(token2);
  });

  test("independent calls for different users produce different tokens", async () => {
    await createSession("user-1", "alice@example.com");
    const token1 = await capturedToken();

    vi.clearAllMocks();
    await createSession("user-2", "bob@example.com");
    const token2 = await capturedToken();

    expect(token1).not.toBe(token2);

    const { payload: p1 } = await jwtVerify(token1, DEFAULT_SECRET);
    const { payload: p2 } = await jwtVerify(token2, DEFAULT_SECRET);
    expect(p1.userId).toBe("user-1");
    expect(p2.userId).toBe("user-2");
  });

  test("token cannot be verified with a wrong secret", async () => {
    await createSession("user-1", "user@example.com");

    const token = await capturedToken();
    const wrongSecret = new TextEncoder().encode("wrong-secret");

    await expect(jwtVerify(token, wrongSecret)).rejects.toThrow();
  });
});
