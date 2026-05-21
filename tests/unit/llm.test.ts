/**
 * Unit tests for LLM rate limiting and basic behavior (src/lib/llm.ts).
 * Logging tests are in llm-logging.test.ts.
 * The LLM module talks to Anthropic only — there is no Gemini/OpenAI fallback.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  loadLLM, mockResponse, anthropicResponse, setupLLMTestEnv,
} from "./llm-helpers";

const env = setupLLMTestEnv();
afterEach(() => env.cleanup());

// ---------------------------------------------------------------------------
// Rate limiting behavior
// ---------------------------------------------------------------------------

describe("completeWithFallback rate limiting", () => {
  it("should return null when request limit is reached", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(anthropicResponse("ok", 10));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      AI_MAX_REQUESTS_PER_HOUR: "3",
      AI_MAX_TOKENS_PER_HOUR: "100000",
    });

    await completeWithFallback("prompt 1");
    await completeWithFallback("prompt 2");
    await completeWithFallback("prompt 3");

    const result = await completeWithFallback("prompt 4");
    expect(result.text).toBeNull();
    expect(result.modelUsed).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("should return null when token limit is reached", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(anthropicResponse("response text", 600));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      AI_MAX_REQUESTS_PER_HOUR: "100",
      AI_MAX_TOKENS_PER_HOUR: "1000",
    });

    const result1 = await completeWithFallback("prompt 1");
    expect(result1.text).toBe("response text");
    await completeWithFallback("prompt 2");

    const result3 = await completeWithFallback("prompt 3");
    expect(result3.text).toBeNull();
    expect(result3.modelUsed).toBeNull();
  });

  it("should not count failed requests against the rate limit", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    // First call returns a non-retryable 400 (not in RETRYABLE_STATUSES), so it
    // exits immediately without retries and is not counted against the limit.
    fetchMock.mockResolvedValueOnce(mockResponse({ error: "bad request" }, 400));
    fetchMock.mockResolvedValue(anthropicResponse("success", 10));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      AI_MAX_REQUESTS_PER_HOUR: "2",
      AI_MAX_TOKENS_PER_HOUR: "100000",
    });

    const failedResult = await completeWithFallback("prompt");
    expect(failedResult.text).toBeNull();
    const r1 = await completeWithFallback("prompt 1");
    expect(r1.text).toBe("success");
    const r2 = await completeWithFallback("prompt 2");
    expect(r2.text).toBe("success");
  });

  it("should return null for both text and modelUsed when rate limited", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(anthropicResponse("ok", 10));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      AI_MAX_REQUESTS_PER_HOUR: "1",
      AI_MAX_TOKENS_PER_HOUR: "100000",
    });

    await completeWithFallback("prompt 1");
    const result = await completeWithFallback("prompt 2");
    expect(result).toEqual({ text: null, modelUsed: null });
  });
});

// ---------------------------------------------------------------------------
// Basic behavior
// ---------------------------------------------------------------------------

describe("completeWithFallback cache hit", () => {
  it("should return cached response without calling fetch", async () => {
    const { getCachedResponse } = await import("@/lib/llm-cache");
    vi.mocked(getCachedResponse).mockResolvedValueOnce({
      response: "cached text",
      modelUsed: "anthropic",
    });

    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM();

    const result = await completeWithFallback("prompt");
    expect(result).toEqual({ text: "cached text", modelUsed: "anthropic" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("completeWithFallback basic behavior", () => {
  it("should return null when no API key is configured", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      ANTHROPIC_API_KEY: undefined,
    });

    const result = await completeWithFallback("test prompt");
    expect(result.text).toBeNull();
    expect(result.modelUsed).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should call Anthropic and return its result", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(anthropicResponse("anthropic result"));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM();

    const result = await completeWithFallback("prompt");
    expect(result.text).toBe("anthropic result");
    expect(result.modelUsed).toBe("anthropic");
    expect(fetchMock).toHaveBeenCalledOnce();
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("api.anthropic.com");
  });

  it("should throttle Anthropic for 15 minutes on a 429 response", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValueOnce(mockResponse({ error: "rate limited" }, 429));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM();

    // First call: Anthropic 429 → returns null, sets 15-min throttle
    const result1 = await completeWithFallback("prompt 1");
    expect(result1.text).toBeNull();

    // Second call: throttled, no fetch attempt
    const result2 = await completeWithFallback("prompt 2");
    expect(result2.text).toBeNull();
    expect(result2.modelUsed).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should retry on transient 5xx errors with backoff", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValueOnce(mockResponse({}, 529)); // overloaded — retry
    fetchMock.mockResolvedValueOnce(anthropicResponse("recovered", 20));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM();

    const promise = completeWithFallback("prompt");
    // Drive the retry backoff timer forward
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result.text).toBe("recovered");
    expect(result.modelUsed).toBe("anthropic");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// Sliding window reset behavior
// ---------------------------------------------------------------------------

describe("sliding window reset", () => {
  it("should reset usage when the window has expired", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(anthropicResponse("ok", 50));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      AI_MAX_REQUESTS_PER_HOUR: "2",
      AI_MAX_TOKENS_PER_HOUR: "100000",
    });

    await completeWithFallback("prompt 1");
    await completeWithFallback("prompt 2");
    const blocked = await completeWithFallback("prompt 3");
    expect(blocked.text).toBeNull();

    vi.useFakeTimers();
    vi.advanceTimersByTime(61 * 60 * 1000);
    const result = await completeWithFallback("prompt 4");
    expect(result.text).toBe("ok");
    expect(result.modelUsed).toBe("anthropic");
    vi.useRealTimers();
  });

  it("should allow new requests after the rate limit window resets", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(anthropicResponse("ok", 10));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      AI_MAX_REQUESTS_PER_HOUR: "2",
      AI_MAX_TOKENS_PER_HOUR: "100000",
    });

    await completeWithFallback("prompt 1");
    await completeWithFallback("prompt 2");
    const blocked = await completeWithFallback("prompt 3");
    expect(blocked.text).toBeNull();

    vi.useFakeTimers();
    vi.advanceTimersByTime(61 * 60 * 1000);
    const result = await completeWithFallback("prompt 4");
    expect(result.text).toBe("ok");
    expect(result.modelUsed).toBe("anthropic");
    vi.useRealTimers();
  });
});
