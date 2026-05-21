/**
 * Shared helpers for LLM test files.
 * Provides mock Response builders and module loading utilities.
 * LLM module is Anthropic-only (no Gemini/OpenAI fallback chain).
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

vi.mock("@/lib/llm-cache", () => ({
  getCachedResponse: vi.fn().mockResolvedValue(null),
  setCachedResponse: vi.fn().mockResolvedValue(undefined),
}));

/**
 * Helper: set env vars, reset modules, dynamically import the real LLM module.
 */
export async function loadLLM(envOverrides: Record<string, string | undefined> = {}) {
  // Always supply a default key unless caller explicitly overrides
  const merged = { ANTHROPIC_API_KEY: "test-anthropic-key", ...envOverrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  vi.resetModules();
  const mod = await import("@/lib/llm");
  return {
    completeWithFallback: mod.completeWithFallback,
    isAiConfigured: mod.isAiConfigured,
    isAiRateLimited: mod.isAiRateLimited,
  };
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

/** Helper to build a successful Anthropic Messages API response. */
export function anthropicResponse(text: string, totalTokens = 50) {
  // Split tokens roughly 50/50 between input/output for accounting purposes
  const half = Math.floor(totalTokens / 2);
  return mockResponse({
    content: [{ type: "text", text }],
    usage: { input_tokens: half, output_tokens: totalTokens - half },
  });
}

/** Save and restore env/fetch between tests. */
export function setupLLMTestEnv() {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  return {
    cleanup() {
      globalThis.fetch = originalFetch;
      process.env.ANTHROPIC_API_KEY = originalEnv.ANTHROPIC_API_KEY;
      process.env.ANTHROPIC_MODEL = originalEnv.ANTHROPIC_MODEL;
      process.env.AI_MAX_REQUESTS_PER_HOUR = originalEnv.AI_MAX_REQUESTS_PER_HOUR;
      process.env.AI_MAX_TOKENS_PER_HOUR = originalEnv.AI_MAX_TOKENS_PER_HOUR;
      vi.restoreAllMocks();
      vi.resetModules();
    },
  };
}
