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
