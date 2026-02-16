/**
 * Unit tests for LLM rate limiting and basic behavior (src/lib/llm.ts).
 * Logging tests are in llm-logging.test.ts.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  loadLLM, mockResponse, geminiResponse, openaiResponse, setupLLMTestEnv,
} from "./llm-helpers";

const env = setupLLMTestEnv();
afterEach(() => env.cleanup());

// ---------------------------------------------------------------------------
// Rate limiting behavior
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
    fetchMock.mockResolvedValue(geminiResponse("response text", 600));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: "test-key",
      OPENAI_API_KEY: undefined,
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
    fetchMock.mockResolvedValueOnce(mockResponse({ error: "server error" }, 500));
    fetchMock.mockResolvedValue(geminiResponse("success", 10));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: "test-key",
      OPENAI_API_KEY: undefined,
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
    fetchMock.mockResolvedValue(geminiResponse("ok", 10));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: "test-key",
      OPENAI_API_KEY: undefined,
      AI_MAX_REQUESTS_PER_HOUR: "1",
      AI_MAX_TOKENS_PER_HOUR: "100000",
    });

    await completeWithFallback("prompt 1");
    const result = await completeWithFallback("prompt 2");
    expect(result).toEqual({ text: null, modelUsed: null });
  });

  it("should track usage from OpenAI fallback calls against rate limit", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValueOnce(mockResponse({ error: "error" }, 500));
    fetchMock.mockResolvedValueOnce(openaiResponse("openai result", 600));
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
    await completeWithFallback("prompt 2");
    const blocked = await completeWithFallback("prompt 3");
    expect(blocked.text).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Basic behavior
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
    fetchMock.mockResolvedValueOnce(mockResponse({}, 429));
    fetchMock.mockResolvedValueOnce(openaiResponse("fallback"));
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

    await completeWithFallback("prompt 1");
    await completeWithFallback("prompt 2");
    const blocked = await completeWithFallback("prompt 3");
    expect(blocked.text).toBeNull();

    vi.useFakeTimers();
    vi.advanceTimersByTime(61 * 60 * 1000);
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

    await completeWithFallback("prompt 1");
    await completeWithFallback("prompt 2");
    const blocked = await completeWithFallback("prompt 3");
    expect(blocked.text).toBeNull();

    vi.useFakeTimers();
    vi.advanceTimersByTime(61 * 60 * 1000);
    const result = await completeWithFallback("prompt 4");
    expect(result.text).toBe("ok");
    expect(result.modelUsed).toBe("gemini");
    vi.useRealTimers();
  });
});
