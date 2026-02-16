/**
 * Unit tests for LLM rate limiting (src/lib/llm.ts).
 *
 * Covers:
 *  - completeWithFallback returns null when rate limited
 *  - Sliding window resets after an hour
 *  - Rate limits respect both request count and token count
 *
 * Strategy:
 *  - Uses vi.resetModules + dynamic import so each test group gets a fresh
 *    module instance with clean rate-limit state and fresh env var reads.
 *  - Mocks global `fetch` to avoid real API calls.
 */

import { describe, it, expect, vi, afterEach } from "vitest";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.GEMINI_API_KEY = originalEnv.GEMINI_API_KEY;
  process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY;
  process.env.GEMINI_MODEL = originalEnv.GEMINI_MODEL;
  process.env.OPENAI_MODEL = originalEnv.OPENAI_MODEL;
  process.env.AI_MAX_REQUESTS_PER_HOUR = originalEnv.AI_MAX_REQUESTS_PER_HOUR;
  process.env.AI_MAX_TOKENS_PER_HOUR = originalEnv.AI_MAX_TOKENS_PER_HOUR;
  vi.restoreAllMocks();
  vi.resetModules();
});

/**
 * Helper: set env vars, reset modules, dynamically import the real LLM module.
 */
async function loadLLM(envOverrides: Record<string, string | undefined> = {}) {
  for (const [key, value] of Object.entries(envOverrides)) {
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
  };
}

/** Create a mock Response matching the fetch Response interface. */
function mockResponse(body: unknown, status = 200): Response {
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
function geminiResponse(text: string, totalTokenCount = 50) {
  return mockResponse({
    candidates: [{ content: { parts: [{ text }] } }],
    usageMetadata: { totalTokenCount },
  });
}

/** Helper to build a successful OpenAI response. */
function openaiResponse(text: string, totalTokens = 50) {
  return mockResponse({
    choices: [{ message: { content: text } }],
    usage: { total_tokens: totalTokens },
  });
}

// ---------------------------------------------------------------------------
// completeWithFallback - rate limiting behavior
// ---------------------------------------------------------------------------

describe("completeWithFallback rate limiting", () => {
  it("should return null when request limit is reached", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(geminiResponse("ok", 10));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: "test-key",
      OPENAI_API_KEY: undefined,
      AI_MAX_REQUESTS_PER_HOUR: "3",
      AI_MAX_TOKENS_PER_HOUR: "100000",
    });

    // Make 3 requests (the limit)
    await completeWithFallback("prompt 1");
    await completeWithFallback("prompt 2");
    await completeWithFallback("prompt 3");

    // 4th request should be rate limited
    const result = await completeWithFallback("prompt 4");
    expect(result.text).toBeNull();
    expect(result.modelUsed).toBeNull();

    // fetch should only be called 3 times (the 4th was blocked)
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("should return null when token limit is reached", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    // Each call uses 600 tokens, limit is 1000
    fetchMock.mockResolvedValue(geminiResponse("response text", 600));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: "test-key",
      OPENAI_API_KEY: undefined,
      AI_MAX_REQUESTS_PER_HOUR: "100",
      AI_MAX_TOKENS_PER_HOUR: "1000",
    });

    // First call: 600 tokens used (under 1000)
    const result1 = await completeWithFallback("prompt 1");
    expect(result1.text).toBe("response text");

    // Second call: 1200 tokens total (over 1000)
    await completeWithFallback("prompt 2");

    // Third call should be rate limited
    const result3 = await completeWithFallback("prompt 3");
    expect(result3.text).toBeNull();
    expect(result3.modelUsed).toBeNull();
  });

  it("should not count failed requests against the rate limit", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    // First call: server error (no text returned, no usage tracked)
    fetchMock.mockResolvedValueOnce(mockResponse({ error: "server error" }, 500));
    // Subsequent calls: success
    fetchMock.mockResolvedValue(geminiResponse("success", 10));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: "test-key",
      OPENAI_API_KEY: undefined,
      AI_MAX_REQUESTS_PER_HOUR: "2",
      AI_MAX_TOKENS_PER_HOUR: "100000",
    });

    // This call fails (500 error), should not be tracked
    const failedResult = await completeWithFallback("prompt");
    expect(failedResult.text).toBeNull();

    // Two more successful calls should work (limit = 2)
    const r1 = await completeWithFallback("prompt 1");
    expect(r1.text).toBe("success");
    const r2 = await completeWithFallback("prompt 2");
    expect(r2.text).toBe("success");
  });

  it("should return null for both text and modelUsed when rate limited", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(geminiResponse("ok", 10));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: "test-key",
      OPENAI_API_KEY: undefined,
      AI_MAX_REQUESTS_PER_HOUR: "1",
      AI_MAX_TOKENS_PER_HOUR: "100000",
    });

    // Exhaust the limit
    await completeWithFallback("prompt 1");

    // This should be rate limited
    const result = await completeWithFallback("prompt 2");
    expect(result).toEqual({ text: null, modelUsed: null });
  });

  it("should track usage from OpenAI fallback calls against rate limit", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    // Gemini fails, OpenAI succeeds (each call uses 600 tokens)
    fetchMock.mockResolvedValueOnce(mockResponse({ error: "error" }, 500));
    fetchMock.mockResolvedValueOnce(openaiResponse("openai result", 600));
    // Second call: Gemini fails, OpenAI succeeds again
    fetchMock.mockResolvedValueOnce(mockResponse({ error: "error" }, 500));
    fetchMock.mockResolvedValueOnce(openaiResponse("openai result 2", 600));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: "test-key",
      OPENAI_API_KEY: "test-openai-key",
      AI_MAX_REQUESTS_PER_HOUR: "100",
      AI_MAX_TOKENS_PER_HOUR: "1000",
    });

    const result = await completeWithFallback("prompt");
    expect(result.modelUsed).toBe("openai");

    // Second call pushes tokens over limit (1200 > 1000)
    await completeWithFallback("prompt 2");

    // Third call should be rate limited
    const blocked = await completeWithFallback("prompt 3");
    expect(blocked.text).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// completeWithFallback - basic behavior with mocked fetch
// ---------------------------------------------------------------------------

describe("completeWithFallback basic behavior", () => {
  it("should return null when no API keys are configured", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: undefined,
      OPENAI_API_KEY: undefined,
    });

    const result = await completeWithFallback("test prompt");

    expect(result.text).toBeNull();
    expect(result.modelUsed).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should try Gemini first when both keys are set", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(geminiResponse("gemini result"));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: "test-gemini-key",
      OPENAI_API_KEY: "test-openai-key",
    });

    const result = await completeWithFallback("prompt");

    expect(result.text).toBe("gemini result");
    expect(result.modelUsed).toBe("gemini");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("should fall back to OpenAI when Gemini is throttled (429)", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValueOnce(mockResponse({}, 429)); // Gemini 429
    fetchMock.mockResolvedValueOnce(openaiResponse("fallback")); // OpenAI ok
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: "test-gemini-key",
      OPENAI_API_KEY: "test-openai-key",
    });

    const result = await completeWithFallback("prompt");

    expect(result.text).toBe("fallback");
    expect(result.modelUsed).toBe("openai");
  });

  it("should use only OpenAI when only OPENAI_API_KEY is set", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(openaiResponse("openai only"));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: undefined,
      OPENAI_API_KEY: "test-openai-key",
    });

    const result = await completeWithFallback("prompt");

    expect(result.text).toBe("openai only");
    expect(result.modelUsed).toBe("openai");
    expect(fetchMock).toHaveBeenCalledOnce();
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("api.openai.com");
  });
});

// ---------------------------------------------------------------------------
// Sliding window reset behavior
// ---------------------------------------------------------------------------

describe("sliding window reset", () => {
  it("should reset usage when the window has expired", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(geminiResponse("ok", 50));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: "test-key",
      OPENAI_API_KEY: undefined,
      AI_MAX_REQUESTS_PER_HOUR: "2",
      AI_MAX_TOKENS_PER_HOUR: "100000",
    });

    // Exhaust the limit (2 requests)
    await completeWithFallback("prompt 1");
    await completeWithFallback("prompt 2");

    // Should be rate limited
    const blocked = await completeWithFallback("prompt 3");
    expect(blocked.text).toBeNull();

    // Simulate window expiry by advancing time by more than 1 hour
    vi.useFakeTimers();
    vi.advanceTimersByTime(61 * 60 * 1000); // 61 minutes

    // After window reset, requests should work again
    const result = await completeWithFallback("prompt 4");
    expect(result.text).toBe("ok");
    expect(result.modelUsed).toBe("gemini");

    vi.useRealTimers();
  });

  it("should allow new requests after the rate limit window resets", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(geminiResponse("ok", 10));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: "test-key",
      OPENAI_API_KEY: undefined,
      AI_MAX_REQUESTS_PER_HOUR: "2",
      AI_MAX_TOKENS_PER_HOUR: "100000",
    });

    // Exhaust limit
    await completeWithFallback("prompt 1");
    await completeWithFallback("prompt 2");

    // Should be rate limited
    const blocked = await completeWithFallback("prompt 3");
    expect(blocked.text).toBeNull();

    // Advance time past the 1-hour window
    vi.useFakeTimers();
    vi.advanceTimersByTime(61 * 60 * 1000);

    // Should work again after window reset
    const result = await completeWithFallback("prompt 4");
    expect(result.text).toBe("ok");
    expect(result.modelUsed).toBe("gemini");

    vi.useRealTimers();
  });
});
