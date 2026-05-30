import { anthropic } from "@ai-sdk/anthropic";
import {
  LanguageModelV1,
  LanguageModelV1StreamPart,
  LanguageModelV1Message,
} from "@ai-sdk/provider";

const MODEL = "claude-haiku-4-5";

export class MockLanguageModel implements LanguageModelV1 {
  readonly specificationVersion = "v1" as const;
  readonly provider = "mock";
  readonly modelId: string;
  readonly defaultObjectGenerationMode = "tool" as const;

  constructor(modelId: string) {
    this.modelId = modelId;
  }

  private async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private extractUserPrompt(messages: LanguageModelV1Message[]): string {
    // Find the last user message
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role === "user") {
        const content = message.content;
        if (Array.isArray(content)) {
          // Extract text from content parts
          const textParts = content
            .filter((part: any) => part.type === "text")
            .map((part: any) => part.text);
          return textParts.join(" ");
        } else if (typeof content === "string") {
          return content;
        }
      }
    }
    return "";
  }

  private getLastToolResult(messages: LanguageModelV1Message[]): any {
    // Find the last tool message
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "tool") {
        const content = messages[i].content;
        if (Array.isArray(content) && content.length > 0) {
          return content[0];
        }
      }
    }
    return null;
  }

  private async *generateMockStream(
    messages: LanguageModelV1Message[],
    userPrompt: string
  ): AsyncGenerator<LanguageModelV1StreamPart> {
    // Count tool messages to determine which step we're on
    const toolMessageCount = messages.filter((m) => m.role === "tool").length;

    // Determine component type from the original user prompt
    const promptLower = userPrompt.toLowerCase();
    let componentType = "counter";
    let componentName = "Counter";

    if (promptLower.includes("form")) {
      componentType = "form";
      componentName = "ContactForm";
    } else if (promptLower.includes("card")) {
      componentType = "card";
      componentName = "Card";
    }

    // Step 1: Create component file
    if (toolMessageCount === 1) {
      const text = `I'll create a ${componentName} component for you.`;
      for (const char of text) {
        yield { type: "text-delta", textDelta: char };
        await this.delay(25);
      }

      yield {
        type: "tool-call",
        toolCallType: "function",
        toolCallId: `call_1`,
        toolName: "str_replace_editor",
        args: JSON.stringify({
          command: "create",
          path: `/components/${componentName}.jsx`,
          file_text: this.getComponentCode(componentType),
        }),
      };

      yield {
        type: "finish",
        finishReason: "tool-calls",
        usage: {
          promptTokens: 50,
          completionTokens: 30,
        },
      };
      return;
    }

    // Step 2: Enhance component
    if (toolMessageCount === 2) {
      const text = `Now let me enhance the component with better styling.`;
      for (const char of text) {
        yield { type: "text-delta", textDelta: char };
        await this.delay(25);
      }

      yield {
        type: "tool-call",
        toolCallType: "function",
        toolCallId: `call_2`,
        toolName: "str_replace_editor",
        args: JSON.stringify({
          command: "str_replace",
          path: `/components/${componentName}.jsx`,
          old_str: this.getOldStringForReplace(componentType),
          new_str: this.getNewStringForReplace(componentType),
        }),
      };

      yield {
        type: "finish",
        finishReason: "tool-calls",
        usage: {
          promptTokens: 50,
          completionTokens: 30,
        },
      };
      return;
    }

    // Step 3: Create App.jsx
    if (toolMessageCount === 0) {
      const text = `This is a static response. You can place an Anthropic API key in the .env file to use the Anthropic API for component generation. Let me create an App.jsx file to display the component.`;
      for (const char of text) {
        yield { type: "text-delta", textDelta: char };
        await this.delay(15);
      }

      yield {
        type: "tool-call",
        toolCallType: "function",
        toolCallId: `call_3`,
        toolName: "str_replace_editor",
        args: JSON.stringify({
          command: "create",
          path: "/App.jsx",
          file_text: this.getAppCode(componentName),
        }),
      };

      yield {
        type: "finish",
        finishReason: "tool-calls",
        usage: {
          promptTokens: 50,
          completionTokens: 30,
        },
      };
      return;
    }

    // Step 4: Final summary (no tool call)
    if (toolMessageCount >= 3) {
      const text = `Perfect! I've created:

1. **${componentName}.jsx** - A fully-featured ${componentType} component
2. **App.jsx** - The main app file that displays the component

The component is now ready to use. You can see the preview on the right side of the screen.`;

      for (const char of text) {
        yield { type: "text-delta", textDelta: char };
        await this.delay(30);
      }

      yield {
        type: "finish",
        finishReason: "stop",
        usage: {
          promptTokens: 50,
          completionTokens: 50,
        },
      };
      return;
    }
  }

  private getComponentCode(componentType: string): string {
    switch (componentType) {
      case "form":
        return `import React, { useState } from 'react';

const ContactForm = () => {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="max-w-lg w-full p-10 bg-zinc-900 rounded-2xl ring-1 ring-white/5 shadow-2xl flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <span className="text-emerald-400 text-xl">✓</span>
        </div>
        <h3 className="text-xl font-bold text-white">Message sent!</h3>
        <p className="text-zinc-400 text-sm text-center">We'll get back to you within 24 hours.</p>
        <button onClick={() => setSubmitted(false)} className="text-sm text-violet-400 hover:text-violet-300 transition-colors mt-2">
          Send another →
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg w-full p-10 bg-zinc-900 rounded-2xl ring-1 ring-white/5 shadow-2xl">
      <h2 className="text-3xl font-black tracking-tight text-white mb-1">Get in touch</h2>
      <p className="text-zinc-500 text-sm mb-8">We'll get back to you within 24 hours.</p>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Name</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="Jane Smith"
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="jane@example.com"
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-sm" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Message</label>
          <textarea name="message" value={formData.message} onChange={handleChange} required rows={4} placeholder="Tell us what's on your mind..."
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all resize-none text-sm" />
        </div>
        <button type="submit"
          className="w-full py-3 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-500 hover:-translate-y-0.5 active:scale-95 transition-all duration-150 shadow-lg shadow-violet-900/40 text-sm">
          Send message →
        </button>
      </form>
    </div>
  );
};

export default ContactForm;`;

      case "card":
        return `import React from 'react';

const Card = ({
  title = "Ship faster than ever",
  description = "A modern toolkit built for teams who care about craft. Build, iterate, and launch — without compromise.",
  imageUrl,
  actions
}) => {
  return (
    <div className="relative overflow-hidden rounded-2xl p-px bg-gradient-to-br from-violet-500 to-indigo-700 shadow-2xl shadow-indigo-950/60">
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 p-8">
        {imageUrl && (
          <img src={imageUrl} alt={title} className="w-full h-44 object-cover rounded-xl mb-6 opacity-80" />
        )}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/15 border border-violet-500/25 mb-5">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
          <span className="text-xs font-semibold text-violet-300 tracking-wide uppercase">New</span>
        </div>
        <h3 className="text-2xl font-black tracking-tight text-white mb-3 leading-tight">{title}</h3>
        <p className="text-slate-400 leading-relaxed text-sm mb-6">{description}</p>
        {actions && <div>{actions}</div>}
      </div>
    </div>
  );
};

export default Card;`;

      default:
        return `import { useState } from 'react';

const Counter = () => {
  const [count, setCount] = useState(0);

  return (
    <div className="flex flex-col items-center gap-8 p-12 bg-zinc-900 rounded-2xl ring-1 ring-white/5 shadow-2xl">
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase">Counter</p>
      <div className="text-8xl font-black tracking-tight text-white tabular-nums">{count}</div>
      <div className="flex gap-3">
        <button
          onClick={() => setCount(c => c - 1)}
          className="w-12 h-12 flex items-center justify-center bg-zinc-800 text-zinc-300 rounded-xl font-bold text-lg hover:bg-zinc-700 hover:-translate-y-0.5 active:scale-95 transition-all duration-150 border border-zinc-700"
        >
          −
        </button>
        <button
          onClick={() => setCount(0)}
          className="px-5 h-12 bg-zinc-800 text-zinc-500 rounded-xl font-semibold text-sm hover:bg-zinc-700 active:scale-95 transition-all duration-150 border border-zinc-700"
        >
          Reset
        </button>
        <button
          onClick={() => setCount(c => c + 1)}
          className="w-12 h-12 flex items-center justify-center bg-violet-600 text-white rounded-xl font-bold text-lg hover:bg-violet-500 hover:-translate-y-0.5 active:scale-95 transition-all duration-150 shadow-lg shadow-violet-900/50"
        >
          +
        </button>
      </div>
    </div>
  );
};

export default Counter;`;
    }
  }

  private getOldStringForReplace(componentType: string): string {
    switch (componentType) {
      case "form":
        return '          className="w-full py-3 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-500 hover:-translate-y-0.5 active:scale-95 transition-all duration-150 shadow-lg shadow-violet-900/40 text-sm">';
      case "card":
        return '          <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />';
      default:
        return '      <div className="text-8xl font-black tracking-tight text-white tabular-nums">{count}</div>';
    }
  }

  private getNewStringForReplace(componentType: string): string {
    switch (componentType) {
      case "form":
        return '          className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-violet-500 hover:to-indigo-500 hover:-translate-y-0.5 active:scale-95 transition-all duration-150 shadow-lg shadow-violet-900/40 text-sm">';
      case "card":
        return '          <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />';
      default:
        return '      <div className="text-8xl font-black tracking-tight text-violet-100 drop-shadow-[0_0_40px_rgba(139,92,246,0.35)] tabular-nums">{count}</div>';
    }
  }

  private getAppCode(componentName: string): string {
    if (componentName === "Card") {
      return `import Card from '@/components/Card';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <Card
          title="Ship faster than ever"
          description="A modern toolkit built for teams who care about craft. Build, iterate, and launch — without compromise."
          actions={
            <button className="px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-500 hover:-translate-y-0.5 active:scale-95 transition-all duration-150 shadow-lg shadow-violet-900/40">
              Get started →
            </button>
          }
        />
      </div>
    </div>
  );
}`;
    }

    return `import ${componentName} from '@/components/${componentName}';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
      <${componentName} />
    </div>
  );
}`;
  }

  async doGenerate(
    options: Parameters<LanguageModelV1["doGenerate"]>[0]
  ): Promise<Awaited<ReturnType<LanguageModelV1["doGenerate"]>>> {
    const userPrompt = this.extractUserPrompt(options.prompt);

    // Collect all stream parts
    const parts: LanguageModelV1StreamPart[] = [];
    for await (const part of this.generateMockStream(
      options.prompt,
      userPrompt
    )) {
      parts.push(part);
    }

    // Build response from parts
    const textParts = parts
      .filter((p) => p.type === "text-delta")
      .map((p) => (p as any).textDelta)
      .join("");

    const toolCalls = parts
      .filter((p) => p.type === "tool-call")
      .map((p) => ({
        toolCallType: "function" as const,
        toolCallId: (p as any).toolCallId,
        toolName: (p as any).toolName,
        args: (p as any).args,
      }));

    // Get finish reason from finish part
    const finishPart = parts.find((p) => p.type === "finish") as any;
    const finishReason = finishPart?.finishReason || "stop";

    return {
      text: textParts,
      toolCalls,
      finishReason: finishReason as any,
      usage: {
        promptTokens: 100,
        completionTokens: 200,
      },
      warnings: [],
      rawCall: {
        rawPrompt: options.prompt,
        rawSettings: {
          maxTokens: options.maxTokens,
          temperature: options.temperature,
        },
      },
    };
  }

  async doStream(
    options: Parameters<LanguageModelV1["doStream"]>[0]
  ): Promise<Awaited<ReturnType<LanguageModelV1["doStream"]>>> {
    const userPrompt = this.extractUserPrompt(options.prompt);
    const self = this;

    const stream = new ReadableStream<LanguageModelV1StreamPart>({
      async start(controller) {
        try {
          const generator = self.generateMockStream(options.prompt, userPrompt);
          for await (const chunk of generator) {
            controller.enqueue(chunk);
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return {
      stream,
      warnings: [],
      rawCall: {
        rawPrompt: options.prompt,
        rawSettings: {},
      },
      rawResponse: { headers: {} },
    };
  }
}

export function getLanguageModel() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

  if (!apiKey || apiKey === "your-api-key-here") {
    console.log(
      "ANTHROPIC_API_KEY is not set (or is still the placeholder). " +
        "Using the mock provider — responses will be canned. " +
        "Set a real key in .env to generate components with Claude."
    );
    return new MockLanguageModel("mock-" + MODEL);
  }

  return anthropic(MODEL);
}
