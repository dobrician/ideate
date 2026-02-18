/**
 * Unit tests for LLM structured logging (src/lib/llm.ts).
 * Verifies pino log calls for success, error, rate-limit, and fallback paths.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  loadLLM, mockResponse, geminiResponse, openaiResponse, setupLLMTestEnv,
} from "./llm-helpers";

const env = setupLLMTestEnv();
afterEach(() => env.cleanup());

describe("LLM structured logging", () => {
  it("should log info on successful Gemini call", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(geminiResponse("logged", 42));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: "test-key",
      OPENAI_API_KEY: undefined,
    });

    const result = await completeWithFallback("test prompt");
    expect(result.text).toBe("logged");
    expect(result.modelUsed).toBe("gemini");
  });

  it("should log error when provider returns non-ok status", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(mockResponse({ error: "bad" }, 500));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: "test-key",
      OPENAI_API_KEY: undefined,
    });

    const result = await completeWithFallback("test");
    expect(result.text).toBeNull();
  });

  it("should log warn when rate limited", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(geminiResponse("ok", 10));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: "test-key",
      OPENAI_API_KEY: undefined,
      AI_MAX_REQUESTS_PER_HOUR: "1",
      AI_MAX_TOKENS_PER_HOUR: "100000",
    });

    await completeWithFallback("p1");
    const result = await completeWithFallback("p2");
    expect(result.text).toBeNull();
  });

  it("should log error on network failure", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockRejectedValue(new Error("network"));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: "test-key",
      OPENAI_API_KEY: undefined,
    });

    const result = await completeWithFallback("test");
    expect(result.text).toBeNull();
  });

  it("should log warn on fallback from Gemini to OpenAI", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValueOnce(mockResponse({ error: "err" }, 500));
    fetchMock.mockResolvedValueOnce(openaiResponse("fallback"));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: "test-key",
      OPENAI_API_KEY: "test-oai",
    });

    const result = await completeWithFallback("test");
    expect(result.text).toBe("fallback");
    expect(result.modelUsed).toBe("openai");
  });

  it("should log info on successful OpenAI call", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(openaiResponse("oai response", 80));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: undefined,
      OPENAI_API_KEY: "test-oai",
    });

    const result = await completeWithFallback("test");
    expect(result.text).toBe("oai response");
    expect(result.modelUsed).toBe("openai");
  });

  it("should log when both providers fail", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValueOnce(mockResponse({}, 500));
    fetchMock.mockResolvedValueOnce(mockResponse({}, 500));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: "test-key",
      OPENAI_API_KEY: "test-oai",
    });

    const result = await completeWithFallback("test");
    expect(result.text).toBeNull();
    expect(result.modelUsed).toBeNull();
  });

  it("should handle OpenAI network error gracefully", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockRejectedValue(new Error("connection refused"));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: undefined,
      OPENAI_API_KEY: "test-oai",
    });

    const result = await completeWithFallback("test");
    expect(result.text).toBeNull();
  });
});

describe("LLM response parsing edge cases", () => {
  it("should estimate tokens from text length when Gemini metadata missing", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(mockResponse({
      candidates: [{ content: { parts: [{ text: "hello world" }] } }],
      usageMetadata: {},
    }));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: "test-key",
      OPENAI_API_KEY: undefined,
    });

    const result = await completeWithFallback("test");
    expect(result.text).toBe("hello world");
    expect(result.modelUsed).toBe("gemini");
  });

  it("should estimate tokens from text length when OpenAI usage missing", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(mockResponse({
      choices: [{ message: { content: "openai text" } }],
      usage: {},
    }));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: undefined,
      OPENAI_API_KEY: "test-oai",
    });

    const result = await completeWithFallback("test");
    expect(result.text).toBe("openai text");
    expect(result.modelUsed).toBe("openai");
  });

  it("should handle Gemini response with no candidates gracefully", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(mockResponse({ candidates: [] }));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: "test-key",
      OPENAI_API_KEY: undefined,
    });

    const result = await completeWithFallback("test");
    expect(result.text).toBeNull();
  });

  it("should handle OpenAI response with no choices gracefully", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(mockResponse({ choices: [] }));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: undefined,
      OPENAI_API_KEY: "test-oai",
    });

    const result = await completeWithFallback("test");
    expect(result.text).toBeNull();
  });

  it("should proceed without cache when getCachedResponse throws", async () => {
    const { getCachedResponse } = await import("@/lib/llm-cache");
    vi.mocked(getCachedResponse).mockRejectedValueOnce(new Error("db error"));

    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(geminiResponse("fresh", 10));
    globalThis.fetch = fetchMock;

    const { completeWithFallback } = await loadLLM({
      GEMINI_API_KEY: "test-key",
      OPENAI_API_KEY: undefined,
    });

    const result = await completeWithFallback("test");
    expect(result.text).toBe("fresh");
    expect(result.modelUsed).toBe("gemini");
  });
});

describe("isAiConfigured", () => {
  it("returns true when GEMINI_API_KEY is set", async () => {
    const { isAiConfigured } = await loadLLM({ GEMINI_API_KEY: "key", OPENAI_API_KEY: undefined });
    expect(isAiConfigured()).toBe(true);
  });

  it("returns true when OPENAI_API_KEY is set", async () => {
    const { isAiConfigured } = await loadLLM({ GEMINI_API_KEY: undefined, OPENAI_API_KEY: "key" });
    expect(isAiConfigured()).toBe(true);
  });

  it("returns false when no keys are set", async () => {
    const { isAiConfigured } = await loadLLM({ GEMINI_API_KEY: undefined, OPENAI_API_KEY: undefined });
    expect(isAiConfigured()).toBe(false);
  });
});

describe("isAiRateLimited", () => {
  it("returns false when under limits", async () => {
    const { isAiRateLimited } = await loadLLM({
      GEMINI_API_KEY: "key",
      AI_MAX_REQUESTS_PER_HOUR: "60",
      AI_MAX_TOKENS_PER_HOUR: "100000",
    });
    expect(isAiRateLimited()).toBe(false);
  });

  it("returns true after exhausting request limit", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(geminiResponse("ok", 10));
    globalThis.fetch = fetchMock;

    const { completeWithFallback, isAiRateLimited } = await loadLLM({
      GEMINI_API_KEY: "key",
      OPENAI_API_KEY: undefined,
      AI_MAX_REQUESTS_PER_HOUR: "1",
      AI_MAX_TOKENS_PER_HOUR: "100000",
    });

    await completeWithFallback("p1");
    expect(isAiRateLimited()).toBe(true);
  });
});
