/**
 * Unit tests for LLM rate limiting and usage tracking (src/lib/llm.ts).
 *
 * Covers:
 *  - getAiUsageStats returns current usage statistics
 *  - completeWithFallback returns null when rate limited
 *  - Usage tracking increments requests and tokens
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
    getAiUsageStats: mod.getAiUsageStats,
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
// getAiUsageStats
// ---------------------------------------------------------------------------

describe("getAiUsageStats", () => {
  it("should return initial stats with zero usage", async () => {
    const { getAiUsageStats } = await loadLLM({
      GEMINI_API_KEY: undefined,
      OPENAI_API_KEY: undefined,
      AI_MAX_REQUESTS_PER_HOUR: "60",
      AI_MAX_TOKENS_PER_HOUR: "100000",
    });

    const stats = getAiUsageStats();

    expect(stats.requests).toBe(0);
    expect(stats.tokens).toBe(0);
    expect(stats.costUsd).toBe(0);
    expect(stats.maxRequests).toBe(60);
    expect(stats.maxTokens).toBe(100000);
    expect(typeof stats.windowStart).toBe("number");
  });

  it("should reflect custom max values from environment variables", async () => {
    const { getAiUsageStats } = await loadLLM({
      GEMINI_API_KEY: undefined,
      OPENAI_API_KEY: undefined,
      AI_MAX_REQUESTS_PER_HOUR: "30",
      AI_MAX_TOKENS_PER_HOUR: "50000",
    });

    const stats = getAiUsageStats();

    expect(stats.maxRequests).toBe(30);
    expect(stats.maxTokens).toBe(50000);
  });

  it("should increment requests and tokens after a successful call", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(geminiResponse("Hello world", 5000));
    globalThis.fetch = fetchMock;

    const { getAiUsageStats, completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: "test-key",
      OPENAI_API_KEY: undefined,
      AI_MAX_REQUESTS_PER_HOUR: "60",
      AI_MAX_TOKENS_PER_HOUR: "100000",
    });

    await completeWithFallback("test prompt");

    const stats = getAiUsageStats();
    expect(stats.requests).toBe(1);
    expect(stats.tokens).toBe(5000);
    // Gemini output cost: (5000/1000) * 0.0003 = 0.0015
    expect(stats.costUsd).toBeGreaterThan(0);
  });

  it("should accumulate usage across multiple calls", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(geminiResponse("response", 100));
    globalThis.fetch = fetchMock;

    const { getAiUsageStats, completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: "test-key",
      OPENAI_API_KEY: undefined,
      AI_MAX_REQUESTS_PER_HOUR: "60",
      AI_MAX_TOKENS_PER_HOUR: "100000",
    });

    await completeWithFallback("prompt 1");
    await completeWithFallback("prompt 2");
    await completeWithFallback("prompt 3");

    const stats = getAiUsageStats();
    expect(stats.requests).toBe(3);
    expect(stats.tokens).toBe(300);
  });

  it("should round costUsd to 4 decimal places", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(geminiResponse("text", 1));
    globalThis.fetch = fetchMock;

    const { getAiUsageStats, completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: "test-key",
      OPENAI_API_KEY: undefined,
      AI_MAX_REQUESTS_PER_HOUR: "60",
      AI_MAX_TOKENS_PER_HOUR: "100000",
    });

    await completeWithFallback("prompt");

    const stats = getAiUsageStats();
    // costUsd should be rounded to 4 decimal places
    const decimalParts = stats.costUsd.toString().split(".");
    if (decimalParts.length > 1) {
      expect(decimalParts[1].length).toBeLessThanOrEqual(4);
    }
  });

  it("should have a windowStart that is a recent timestamp", async () => {
    const before = Date.now();
    const { getAiUsageStats } = await loadLLM({
      GEMINI_API_KEY: undefined,
      OPENAI_API_KEY: undefined,
    });
    const after = Date.now();

    const stats = getAiUsageStats();
    expect(stats.windowStart).toBeGreaterThanOrEqual(before);
    expect(stats.windowStart).toBeLessThanOrEqual(after);
  });
});

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

    const { getAiUsageStats, completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: "test-key",
      OPENAI_API_KEY: undefined,
      AI_MAX_REQUESTS_PER_HOUR: "60",
      AI_MAX_TOKENS_PER_HOUR: "100000",
    });

    // This call fails (500 error), should not be tracked
    const failedResult = await completeWithFallback("prompt");
    expect(failedResult.text).toBeNull();

    const stats = getAiUsageStats();
    expect(stats.requests).toBe(0);
    expect(stats.tokens).toBe(0);
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

  it("should track usage from OpenAI fallback calls", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    // Gemini fails, OpenAI succeeds
    fetchMock.mockResolvedValueOnce(mockResponse({ error: "error" }, 500));
    fetchMock.mockResolvedValueOnce(openaiResponse("openai result", 200));
    globalThis.fetch = fetchMock;

    const { getAiUsageStats, completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: "test-key",
      OPENAI_API_KEY: "test-openai-key",
      AI_MAX_REQUESTS_PER_HOUR: "60",
      AI_MAX_TOKENS_PER_HOUR: "100000",
    });

    const result = await completeWithFallback("prompt");
    expect(result.modelUsed).toBe("openai");

    const stats = getAiUsageStats();
    expect(stats.requests).toBe(1);
    expect(stats.tokens).toBe(200);
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
  it("should reset usage stats when the window has expired", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(geminiResponse("ok", 50));
    globalThis.fetch = fetchMock;

    const { getAiUsageStats, completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: "test-key",
      OPENAI_API_KEY: undefined,
      AI_MAX_REQUESTS_PER_HOUR: "60",
      AI_MAX_TOKENS_PER_HOUR: "100000",
    });

    // Make a request to build up usage
    await completeWithFallback("prompt");

    let stats = getAiUsageStats();
    expect(stats.requests).toBe(1);
    expect(stats.tokens).toBe(50);

    // Simulate window expiry by advancing time by more than 1 hour
    vi.useFakeTimers();
    vi.advanceTimersByTime(61 * 60 * 1000); // 61 minutes

    stats = getAiUsageStats();
    // After window reset, stats should be back to zero
    expect(stats.requests).toBe(0);
    expect(stats.tokens).toBe(0);
    expect(stats.costUsd).toBe(0);

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
