import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// --- hoisted mocks ---

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const { mockSignIn, mockSignUp } = vi.hoisted(() => ({
  mockSignIn: vi.fn(),
  mockSignUp: vi.fn(),
}));

vi.mock("@/actions", () => ({
  signIn: mockSignIn,
  signUp: mockSignUp,
}));

const { mockGetAnonWorkData, mockClearAnonWork } = vi.hoisted(() => ({
  mockGetAnonWorkData: vi.fn(),
  mockClearAnonWork: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: mockGetAnonWorkData,
  clearAnonWork: mockClearAnonWork,
}));

const { mockGetProjects } = vi.hoisted(() => ({
  mockGetProjects: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: mockGetProjects,
}));

const { mockCreateProject } = vi.hoisted(() => ({
  mockCreateProject: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: mockCreateProject,
}));

// --- import under test ---

import { useAuth } from "@/hooks/use-auth";

// --- helpers ---

const SUCCESS = { success: true } as const;
const FAILURE = { success: false, error: "Invalid credentials" } as const;

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no anon work, no existing projects
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "new-project-id" });
});

// --- isLoading ---

describe("isLoading", () => {
  test("starts as false", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  test("is true while signIn is executing", async () => {
    let resolveSignIn!: (v: typeof SUCCESS) => void;
    mockSignIn.mockReturnValue(new Promise((r) => (resolveSignIn = r)));

    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.signIn("a@b.com", "password");
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => resolveSignIn(SUCCESS));
  });

  test("resets to false after signIn resolves with success", async () => {
    mockSignIn.mockResolvedValue(SUCCESS);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password");
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("resets to false after signIn resolves with failure", async () => {
    mockSignIn.mockResolvedValue(FAILURE);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password");
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("resets to false even when signIn throws", async () => {
    mockSignIn.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("is true while signUp is executing", async () => {
    let resolveSignUp!: (v: typeof SUCCESS) => void;
    mockSignUp.mockReturnValue(new Promise((r) => (resolveSignUp = r)));

    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.signUp("a@b.com", "password");
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => resolveSignUp(SUCCESS));
  });

  test("resets to false after signUp resolves", async () => {
    mockSignUp.mockResolvedValue(SUCCESS);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("a@b.com", "password");
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("resets to false even when signUp throws", async () => {
    mockSignUp.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("a@b.com", "password").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });
});

// --- signIn ---

describe("signIn", () => {
  test("calls signInAction with the provided email and password", async () => {
    mockSignIn.mockResolvedValue(FAILURE);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "secret123");
    });

    expect(mockSignIn).toHaveBeenCalledOnce();
    expect(mockSignIn).toHaveBeenCalledWith("user@example.com", "secret123");
  });

  test("returns the success result from signInAction", async () => {
    mockSignIn.mockResolvedValue(SUCCESS);

    const { result } = renderHook(() => useAuth());

    let returnValue: typeof SUCCESS | typeof FAILURE | undefined;
    await act(async () => {
      returnValue = await result.current.signIn("a@b.com", "pass");
    });

    expect(returnValue).toEqual(SUCCESS);
  });

  test("returns the failure result from signInAction", async () => {
    mockSignIn.mockResolvedValue(FAILURE);

    const { result } = renderHook(() => useAuth());

    let returnValue: typeof SUCCESS | typeof FAILURE | undefined;
    await act(async () => {
      returnValue = await result.current.signIn("a@b.com", "wrongpass");
    });

    expect(returnValue).toEqual(FAILURE);
  });

  test("does not trigger post-sign-in navigation when signIn fails", async () => {
    mockSignIn.mockResolvedValue(FAILURE);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "wrongpass");
    });

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockCreateProject).not.toHaveBeenCalled();
    expect(mockGetProjects).not.toHaveBeenCalled();
  });

  test("triggers post-sign-in navigation when signIn succeeds", async () => {
    mockSignIn.mockResolvedValue(SUCCESS);
    mockGetProjects.mockResolvedValue([{ id: "proj-1" }]);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password");
    });

    expect(mockPush).toHaveBeenCalledOnce();
  });
});

// --- signUp ---

describe("signUp", () => {
  test("calls signUpAction with the provided email and password", async () => {
    mockSignUp.mockResolvedValue(FAILURE);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("new@user.com", "newpass1");
    });

    expect(mockSignUp).toHaveBeenCalledOnce();
    expect(mockSignUp).toHaveBeenCalledWith("new@user.com", "newpass1");
  });

  test("returns the success result from signUpAction", async () => {
    mockSignUp.mockResolvedValue(SUCCESS);

    const { result } = renderHook(() => useAuth());

    let returnValue: typeof SUCCESS | typeof FAILURE | undefined;
    await act(async () => {
      returnValue = await result.current.signUp("a@b.com", "pass");
    });

    expect(returnValue).toEqual(SUCCESS);
  });

  test("returns the failure result from signUpAction", async () => {
    mockSignUp.mockResolvedValue(FAILURE);

    const { result } = renderHook(() => useAuth());

    let returnValue: typeof SUCCESS | typeof FAILURE | undefined;
    await act(async () => {
      returnValue = await result.current.signUp("a@b.com", "pass");
    });

    expect(returnValue).toEqual(FAILURE);
  });

  test("does not trigger post-sign-in navigation when signUp fails", async () => {
    mockSignUp.mockResolvedValue(FAILURE);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("a@b.com", "pass");
    });

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  test("triggers post-sign-in navigation when signUp succeeds", async () => {
    mockSignUp.mockResolvedValue(SUCCESS);
    mockGetProjects.mockResolvedValue([{ id: "proj-1" }]);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("a@b.com", "password");
    });

    expect(mockPush).toHaveBeenCalledOnce();
  });
});

// --- handlePostSignIn: anon work path ---

describe("handlePostSignIn — anonymous work", () => {
  test("creates a project with anon messages and fileSystemData", async () => {
    mockSignIn.mockResolvedValue(SUCCESS);
    const anonWork = {
      messages: [{ role: "user", content: "make a button" }],
      fileSystemData: { "/App.jsx": { type: "file", content: "<Button />" } },
    };
    mockGetAnonWorkData.mockReturnValue(anonWork);
    mockCreateProject.mockResolvedValue({ id: "anon-project-id" });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password");
    });

    expect(mockCreateProject).toHaveBeenCalledOnce();
    const callArg = mockCreateProject.mock.calls[0][0];
    expect(callArg.messages).toEqual(anonWork.messages);
    expect(callArg.data).toEqual(anonWork.fileSystemData);
  });

  test("clears anon work after creating the project", async () => {
    mockSignIn.mockResolvedValue(SUCCESS);
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "hi" }],
      fileSystemData: {},
    });
    mockCreateProject.mockResolvedValue({ id: "anon-project-id" });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password");
    });

    expect(mockClearAnonWork).toHaveBeenCalledOnce();
  });

  test("redirects to the anon project's id", async () => {
    mockSignIn.mockResolvedValue(SUCCESS);
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "hi" }],
      fileSystemData: {},
    });
    mockCreateProject.mockResolvedValue({ id: "anon-project-id" });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password");
    });

    expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
  });

  test("does not call getProjects when anon work is present", async () => {
    mockSignIn.mockResolvedValue(SUCCESS);
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "hi" }],
      fileSystemData: {},
    });
    mockCreateProject.mockResolvedValue({ id: "anon-project-id" });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password");
    });

    expect(mockGetProjects).not.toHaveBeenCalled();
  });

  test("skips anon path when anon work has an empty messages array", async () => {
    mockSignIn.mockResolvedValue(SUCCESS);
    mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
    mockGetProjects.mockResolvedValue([{ id: "existing-proj" }]);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password");
    });

    expect(mockClearAnonWork).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/existing-proj");
  });

  test("skips anon path when getAnonWorkData returns null", async () => {
    mockSignIn.mockResolvedValue(SUCCESS);
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([{ id: "existing-proj" }]);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password");
    });

    expect(mockClearAnonWork).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/existing-proj");
  });
});

// --- handlePostSignIn: existing projects path ---

describe("handlePostSignIn — existing projects", () => {
  test("redirects to the most recent project when projects exist", async () => {
    mockSignIn.mockResolvedValue(SUCCESS);
    mockGetProjects.mockResolvedValue([
      { id: "recent-proj" },
      { id: "older-proj" },
    ]);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password");
    });

    expect(mockPush).toHaveBeenCalledWith("/recent-proj");
  });

  test("does not create a new project when existing projects are found", async () => {
    mockSignIn.mockResolvedValue(SUCCESS);
    mockGetProjects.mockResolvedValue([{ id: "recent-proj" }]);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password");
    });

    expect(mockCreateProject).not.toHaveBeenCalled();
  });
});

// --- handlePostSignIn: new project fallback ---

describe("handlePostSignIn — new project fallback", () => {
  test("creates a new project when no projects exist", async () => {
    mockSignIn.mockResolvedValue(SUCCESS);
    mockGetProjects.mockResolvedValue([]);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password");
    });

    expect(mockCreateProject).toHaveBeenCalledOnce();
  });

  test("creates the new project with empty messages and data", async () => {
    mockSignIn.mockResolvedValue(SUCCESS);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "brand-new-proj" });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password");
    });

    const callArg = mockCreateProject.mock.calls[0][0];
    expect(callArg.messages).toEqual([]);
    expect(callArg.data).toEqual({});
  });

  test("redirects to the newly created project's id", async () => {
    mockSignIn.mockResolvedValue(SUCCESS);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "brand-new-proj" });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password");
    });

    expect(mockPush).toHaveBeenCalledWith("/brand-new-proj");
  });

  test("new project name is a non-empty string", async () => {
    mockSignIn.mockResolvedValue(SUCCESS);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "brand-new-proj" });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password");
    });

    const callArg = mockCreateProject.mock.calls[0][0];
    expect(typeof callArg.name).toBe("string");
    expect(callArg.name.length).toBeGreaterThan(0);
  });
});
