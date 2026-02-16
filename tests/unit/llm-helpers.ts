/**
 * Shared helpers for LLM test files.
 * Provides mock Response builders and module loading utilities.
 */

import { vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

/**
 * Helper: set env vars, reset modules, dynamically import the real LLM module.
 */
export async function loadLLM(envOverrides: Record<string, string | undefined> = {}) {
  for (const [key, value] of Object.entries(envOverrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  vi.resetModules();
  const mod = await import("@/lib/llm");
  return { completeWithFallback: mod.completeWithFallback };
}

/** Create a mock Response matching the fetch Response interface. */
export function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    headers: new Headers(),
    redirected: false,
    statusText: status === 200 ? "OK" : "Error",
    type: "basic" as ResponseType,
    url: "",
    clone: () => mockResponse(body, status) as Response,
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(body)),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

/** Helper to build a successful Gemini response. */
export function geminiResponse(text: string, totalTokenCount = 50) {
  return mockResponse({
    candidates: [{ content: { parts: [{ text }] } }],
    usageMetadata: { totalTokenCount },
  });
}

/** Helper to build a successful OpenAI response. */
export function openaiResponse(text: string, totalTokens = 50) {
  return mockResponse({
    choices: [{ message: { content: text } }],
    usage: { total_tokens: totalTokens },
  });
}

/** Save and restore env/fetch between tests. */
export function setupLLMTestEnv() {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  return {
    cleanup() {
      globalThis.fetch = originalFetch;
      process.env.GEMINI_API_KEY = originalEnv.GEMINI_API_KEY;
      process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY;
      process.env.GEMINI_MODEL = originalEnv.GEMINI_MODEL;
      process.env.OPENAI_MODEL = originalEnv.OPENAI_MODEL;
      process.env.AI_MAX_REQUESTS_PER_HOUR = originalEnv.AI_MAX_REQUESTS_PER_HOUR;
      process.env.AI_MAX_TOKENS_PER_HOUR = originalEnv.AI_MAX_TOKENS_PER_HOUR;
      vi.restoreAllMocks();
      vi.resetModules();
    },
  };
}
