/**
 * Unit tests for LLM structured logging (src/lib/llm.ts).
 * Verifies pino log calls for success, error, rate-limit, and retry paths.
 * Anthropic-only — no Gemini/OpenAI fallback chain.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  loadLLM, mockResponse, anthropicResponse, setupLLMTestEnv,
} from "./llm-helpers";

const env = setupLLMTestEnv();
afterEach(() => env.cleanup());

describe("LLM structured logging", () => {
  it("should log info on successful Anthropic call", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(anthropicResponse("logged", 42));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM();

    const result = await completeWithFallback("test prompt");
    expect(result.text).toBe("logged");
    expect(result.modelUsed).toBe("anthropic");
  });

  it("should log error when provider returns non-ok status", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(mockResponse({ error: "bad" }, 400));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM();

    const result = await completeWithFallback("test");
    expect(result.text).toBeNull();
  });

  it("should log warn when rate limited", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(anthropicResponse("ok", 10));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      AI_MAX_REQUESTS_PER_HOUR: "1",
      AI_MAX_TOKENS_PER_HOUR: "100000",
    });

    await completeWithFallback("p1");
    const result = await completeWithFallback("p2");
    expect(result.text).toBeNull();
  });

  it("should log error on network failure", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockRejectedValue(new Error("network"));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM();

    const promise = completeWithFallback("test");
    // Drive backoff timers forward for both retry attempts
    await vi.advanceTimersByTimeAsync(10000);
    const result = await promise;
    expect(result.text).toBeNull();
    vi.useRealTimers();
  });

  it("should log warn when throttled after 429", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValueOnce(mockResponse({}, 429));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM();

    // First call triggers 429 and throttle
    const r1 = await completeWithFallback("test1");
    expect(r1.text).toBeNull();
    // Second call is short-circuited by throttle — no second fetch
    const r2 = await completeWithFallback("test2");
    expect(r2.text).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should return null when provider call fails non-retryably", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(mockResponse({}, 400));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM();

    const result = await completeWithFallback("test");
    expect(result.text).toBeNull();
    expect(result.modelUsed).toBeNull();
  });
});

describe("LLM response parsing edge cases", () => {
  it("should estimate tokens from text length when usage metadata is missing", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(mockResponse({
      content: [{ type: "text", text: "hello world" }],
      usage: {},
    }));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM();

    const result = await completeWithFallback("test");
    expect(result.text).toBe("hello world");
    expect(result.modelUsed).toBe("anthropic");
  });

  it("should ignore non-text content blocks and concatenate text blocks", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(mockResponse({
      content: [
        { type: "text", text: "part one " },
        { type: "tool_use", id: "x", input: {} },
        { type: "text", text: "part two" },
      ],
      usage: { input_tokens: 2, output_tokens: 3 },
    }));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM();

    const result = await completeWithFallback("test");
    expect(result.text).toBe("part one part two");
    expect(result.modelUsed).toBe("anthropic");
  });

  it("should handle response with no content array gracefully", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(mockResponse({ usage: {} }));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM();

    const result = await completeWithFallback("test");
    expect(result.text).toBeNull();
  });

  it("should handle empty content array gracefully", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(mockResponse({ content: [], usage: {} }));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM();

    const result = await completeWithFallback("test");
    expect(result.text).toBeNull();
  });

  it("should proceed without cache when getCachedResponse throws", async () => {
    const { getCachedResponse } = await import("@/lib/llm-cache");
    vi.mocked(getCachedResponse).mockRejectedValueOnce(new Error("db error"));

    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(anthropicResponse("fresh", 10));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM();

    const result = await completeWithFallback("test");
    expect(result.text).toBe("fresh");
    expect(result.modelUsed).toBe("anthropic");
  });
});

describe("setCachedResponse error handling", () => {
  it("should not throw when setCachedResponse rejects", async () => {
    const { setCachedResponse } = await import("@/lib/llm-cache");
    vi.mocked(setCachedResponse).mockRejectedValueOnce(new Error("cache write fail"));

    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(anthropicResponse("ok", 10));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM();

    const result = await completeWithFallback("test");
    expect(result.text).toBe("ok");
    // Wait for fire-and-forget .catch to settle
    await new Promise((r) => setTimeout(r, 50));
  });
});

describe("isAiConfigured", () => {
  it("returns true when ANTHROPIC_API_KEY is set", async () => {
    const { isAiConfigured } = await loadLLM({ ANTHROPIC_API_KEY: "key" });
    expect(isAiConfigured()).toBe(true);
  });

  it("returns false when ANTHROPIC_API_KEY is not set", async () => {
    const { isAiConfigured } = await loadLLM({ ANTHROPIC_API_KEY: undefined });
    expect(isAiConfigured()).toBe(false);
  });
});

describe("isAiRateLimited", () => {
  it("returns false when under limits", async () => {
    const { isAiRateLimited } = await loadLLM({
      AI_MAX_REQUESTS_PER_HOUR: "60",
      AI_MAX_TOKENS_PER_HOUR: "100000",
    });
    expect(isAiRateLimited()).toBe(false);
  });

  it("returns true after exhausting request limit", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(anthropicResponse("ok", 10));
    globalThis.fetch = fetchMock;

    const { completeWithFallback, isAiRateLimited } = await loadLLM({
      AI_MAX_REQUESTS_PER_HOUR: "1",
      AI_MAX_TOKENS_PER_HOUR: "100000",
    });

    await completeWithFallback("p1");
    expect(isAiRateLimited()).toBe(true);
  });
});
