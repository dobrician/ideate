/**
 * Unit tests for AI summarization (src/lib/ai.ts) and LLM layer (src/lib/llm.ts).
 *
 * Strategy:
 *  - ai.ts tests mock the LLM layer (`@/lib/llm`) so we never hit a real API.
 *  - llm.ts tests mock global `fetch` and set API-key env vars *before* the
 *    module is imported (via dynamic import + vi.resetModules).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// ai.ts — mock the LLM dependency
// ---------------------------------------------------------------------------

vi.mock("@/lib/llm", () => ({
  completeWithFallback: vi.fn(),
}));

import {
  generateSummaryFromText,
  fallbackSummary,
  buildProposalSummary,
  buildProjectSummary,
} from "@/lib/ai";
import { completeWithFallback } from "@/lib/llm";

const mockedComplete = vi.mocked(completeWithFallback);

// ---------------------------------------------------------------------------
// generateSummaryFromText
// ---------------------------------------------------------------------------

describe("generateSummaryFromText", () => {
  beforeEach(() => {
    mockedComplete.mockReset();
  });

  it("should return null for empty input", async () => {
    const result = await generateSummaryFromText("");
    expect(result).toBeNull();
    expect(mockedComplete).not.toHaveBeenCalled();
  });

  it("should return null for whitespace-only input", async () => {
    const result = await generateSummaryFromText("   \n\t  ");
    expect(result).toBeNull();
    expect(mockedComplete).not.toHaveBeenCalled();
  });

  it("should call completeWithFallback and return the text", async () => {
    mockedComplete.mockResolvedValue({
      text: "A concise summary.",
      modelUsed: "gemini",
    });

    const result = await generateSummaryFromText("Some long description here.");

    expect(mockedComplete).toHaveBeenCalledOnce();
    expect(result).toBe("A concise summary.");
  });

  it("should pass correct LLM options to completeWithFallback", async () => {
    mockedComplete.mockResolvedValue({ text: "ok", modelUsed: "gemini" });

    await generateSummaryFromText("input", 60, 300);

    const callArgs = mockedComplete.mock.calls[0];
    expect(callArgs[1]).toEqual({
      maxTokens: 180,
      temperature: 0.4,
      topP: 0.9,
    });
  });

  it("should include maxWords and maxChars constraints in the prompt", async () => {
    mockedComplete.mockResolvedValue({ text: "ok", modelUsed: "gemini" });

    await generateSummaryFromText("input", 42, 260);

    const prompt = mockedComplete.mock.calls[0][0];
    expect(prompt).toContain("42 words");
    expect(prompt).toContain("260 characters");
  });

  it("should return null when LLM returns null text", async () => {
    mockedComplete.mockResolvedValue({ text: null, modelUsed: null });

    const result = await generateSummaryFromText("Some text");
    expect(result).toBeNull();
  });

  it("should truncate result to maxChars when provided", async () => {
    const longText = "A".repeat(500);
    mockedComplete.mockResolvedValue({ text: longText, modelUsed: "gemini" });

    const result = await generateSummaryFromText("input", 60, 100);
    expect(result).toHaveLength(100);
  });

  it("should truncate result to 480 chars when maxChars is not provided", async () => {
    const longText = "B".repeat(600);
    mockedComplete.mockResolvedValue({ text: longText, modelUsed: "gemini" });

    const result = await generateSummaryFromText("input");
    expect(result).toHaveLength(480);
  });

  it("should return null when completeWithFallback throws", async () => {
    mockedComplete.mockRejectedValue(new Error("network failure"));

    const result = await generateSummaryFromText("input");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// fallbackSummary
// ---------------------------------------------------------------------------

describe("fallbackSummary", () => {
  it("should return null for null input", () => {
    expect(fallbackSummary(null)).toBeNull();
  });

  it("should return null for undefined input", () => {
    expect(fallbackSummary(undefined)).toBeNull();
  });

  it("should return null for empty string", () => {
    expect(fallbackSummary("")).toBeNull();
  });

  it("should return null for whitespace-only string", () => {
    expect(fallbackSummary("   ")).toBeNull();
  });

  it("should return trimmed text when shorter than maxChars", () => {
    expect(fallbackSummary("  Hello world  ")).toBe("Hello world");
  });

  it("should return text unchanged when exactly maxChars", () => {
    const text = "A".repeat(240);
    expect(fallbackSummary(text)).toBe(text);
  });

  it("should truncate and add ellipsis when exceeding default maxChars (240)", () => {
    const text = "A".repeat(300);
    const result = fallbackSummary(text);

    expect(result).not.toBeNull();
    expect(result!.endsWith("\u2026")).toBe(true);
    // Total length should be maxChars (239 chars of content + 1 ellipsis = 240)
    expect(result!.length).toBeLessThanOrEqual(240);
  });

  it("should truncate to a custom maxChars limit", () => {
    const text = "A".repeat(100);
    const result = fallbackSummary(text, 50);

    expect(result).not.toBeNull();
    expect(result!.endsWith("\u2026")).toBe(true);
    expect(result!.length).toBeLessThanOrEqual(50);
  });

  it("should trim trailing whitespace before the ellipsis", () => {
    // Build a string where truncation lands in a stretch of spaces
    const text = "Hello" + " ".repeat(240) + "World";
    const result = fallbackSummary(text, 20);

    expect(result).not.toBeNull();
    // trimEnd removes trailing spaces before ellipsis
    expect(result!).not.toMatch(/\s\u2026$/);
    expect(result!.endsWith("\u2026")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildProposalSummary
// ---------------------------------------------------------------------------

describe("buildProposalSummary", () => {
  beforeEach(() => {
    mockedComplete.mockReset();
  });

  it("should return AI-generated summary when LLM succeeds", async () => {
    mockedComplete.mockResolvedValue({
      text: "A proposal to improve onboarding.",
      modelUsed: "gemini",
    });

    const result = await buildProposalSummary(
      "Better Onboarding",
      "We want to revamp the onboarding flow to reduce drop-off."
    );

    expect(result).toBe("A proposal to improve onboarding.");
    expect(mockedComplete).toHaveBeenCalledOnce();
  });

  it("should include title and description in the prompt sent to LLM", async () => {
    mockedComplete.mockResolvedValue({ text: "summary", modelUsed: "gemini" });

    await buildProposalSummary("My Title", "My Description");

    const prompt = mockedComplete.mock.calls[0][0];
    expect(prompt).toContain("My Title");
    expect(prompt).toContain("My Description");
  });

  it("should fall back to truncated description when LLM returns null", async () => {
    mockedComplete.mockResolvedValue({ text: null, modelUsed: null });

    const description = "This is a great proposal description.";
    const result = await buildProposalSummary("Title", description);

    expect(result).toBe(description);
  });

  it("should fall back to truncated title when LLM returns null and description is null", async () => {
    mockedComplete.mockResolvedValue({ text: null, modelUsed: null });

    const result = await buildProposalSummary("Awesome Idea", null);

    expect(result).toBe("Awesome Idea");
  });

  it("should fall back to truncated title when LLM returns null and description is undefined", async () => {
    mockedComplete.mockResolvedValue({ text: null, modelUsed: null });

    const result = await buildProposalSummary("Great Plan", undefined);

    expect(result).toBe("Great Plan");
  });

  it("should fall back to truncated title when description is empty string", async () => {
    mockedComplete.mockResolvedValue({ text: null, modelUsed: null });

    const result = await buildProposalSummary("Plan B", "");

    expect(result).toBe("Plan B");
  });

  it("should truncate the AI summary to proposal char limit (260)", async () => {
    const longSummary = "X".repeat(300);
    mockedComplete.mockResolvedValue({ text: longSummary, modelUsed: "gemini" });

    const result = await buildProposalSummary("Title", "Desc");

    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThanOrEqual(260);
  });
});

// ---------------------------------------------------------------------------
// buildProjectSummary
// ---------------------------------------------------------------------------

describe("buildProjectSummary", () => {
  beforeEach(() => {
    mockedComplete.mockReset();
  });

  it("should return AI-generated summary when LLM succeeds", async () => {
    mockedComplete.mockResolvedValue({
      text: "This project delivers a real-time dashboard for metrics.",
      modelUsed: "openai",
    });

    const result = await buildProjectSummary(
      "Metrics Dashboard",
      "Build a real-time dashboard for team metrics."
    );

    expect(result).toBe("This project delivers a real-time dashboard for metrics.");
    expect(mockedComplete).toHaveBeenCalledOnce();
  });

  it("should include title and description in the prompt sent to LLM", async () => {
    mockedComplete.mockResolvedValue({ text: "summary", modelUsed: "gemini" });

    await buildProjectSummary("Project Alpha", "Alpha description");

    const prompt = mockedComplete.mock.calls[0][0];
    expect(prompt).toContain("Project Alpha");
    expect(prompt).toContain("Alpha description");
  });

  it("should fall back to truncated description when LLM returns null", async () => {
    mockedComplete.mockResolvedValue({ text: null, modelUsed: null });

    const description = "A short project description.";
    const result = await buildProjectSummary("Title", description);

    expect(result).toBe(description);
  });

  it("should fall back to truncated title when LLM and description are unavailable", async () => {
    mockedComplete.mockResolvedValue({ text: null, modelUsed: null });

    const result = await buildProjectSummary("Fallback Title", null);

    expect(result).toBe("Fallback Title");
  });

  it("should truncate the AI summary to project char limit (320)", async () => {
    const longSummary = "Y".repeat(400);
    mockedComplete.mockResolvedValue({ text: longSummary, modelUsed: "gemini" });

    const result = await buildProjectSummary("Title", "Desc");

    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThanOrEqual(320);
  });

  it("should use project-specific word limit (48) in the prompt", async () => {
    mockedComplete.mockResolvedValue({ text: "ok", modelUsed: "gemini" });

    await buildProjectSummary("Title", "Desc");

    const prompt = mockedComplete.mock.calls[0][0];
    expect(prompt).toContain("48 words");
  });
});

// ---------------------------------------------------------------------------
// completeWithFallback — dynamic import with mocked fetch
//
// Because llm.ts reads env vars at the top level (const), we use
// vi.resetModules + dynamic import so each test group can set its own
// env vars *before* the module initializes.
// ---------------------------------------------------------------------------

describe("completeWithFallback", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  afterEach(() => {
    globalThis.fetch = originalFetch;
    // Restore env vars we touched
    process.env.GEMINI_API_KEY = originalEnv.GEMINI_API_KEY;
    process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY;
    process.env.GEMINI_MODEL = originalEnv.GEMINI_MODEL;
    process.env.OPENAI_MODEL = originalEnv.OPENAI_MODEL;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  /**
   * Helper: set env vars, unmock the LLM module (which is mocked globally
   * for the ai.ts tests above), reset the module registry, then dynamically
   * import the *real* completeWithFallback so it picks up the new env values.
   */
  async function loadLLM(envOverrides: Record<string, string | undefined> = {}) {
    for (const [key, value] of Object.entries(envOverrides)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    vi.doUnmock("@/lib/llm");
    vi.resetModules();
    const mod = await import("@/lib/llm");
    return mod.completeWithFallback;
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

  // ---- Gemini primary path ----

  it("should call Gemini first and return its result", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(
      mockResponse({
        candidates: [
          { content: { parts: [{ text: "Gemini says hello" }] } },
        ],
      })
    );
    globalThis.fetch = fetchMock;

    const cwf = await loadLLM({
      GEMINI_API_KEY: "test-gemini-key",
      OPENAI_API_KEY: "test-openai-key",
    });

    const result = await cwf("test prompt");

    expect(result.text).toBe("Gemini says hello");
    expect(result.modelUsed).toBe("gemini");
    expect(fetchMock).toHaveBeenCalledOnce();
    // Verify it called the Gemini endpoint
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("generativelanguage.googleapis.com");
  });

  // ---- OpenAI fallback path ----

  it("should fall back to OpenAI when Gemini returns null text", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    // First call: Gemini returns empty candidates
    fetchMock.mockResolvedValueOnce(
      mockResponse({ candidates: [] })
    );
    // Second call: OpenAI succeeds
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        choices: [{ message: { content: "OpenAI fallback" } }],
      })
    );
    globalThis.fetch = fetchMock;

    const cwf = await loadLLM({
      GEMINI_API_KEY: "test-gemini-key",
      OPENAI_API_KEY: "test-openai-key",
    });

    const result = await cwf("test prompt");

    expect(result.text).toBe("OpenAI fallback");
    expect(result.modelUsed).toBe("openai");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // ---- 429 throttling ----

  it("should throttle Gemini for 15 minutes on a 429 response and try OpenAI", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    // First call: Gemini 429
    fetchMock.mockResolvedValueOnce(mockResponse({ error: "rate limited" }, 429));
    // Second call: OpenAI succeeds
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        choices: [{ message: { content: "OpenAI after throttle" } }],
      })
    );
    // Third call (second invocation): OpenAI succeeds again (Gemini still throttled)
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        choices: [{ message: { content: "OpenAI still" } }],
      })
    );
    globalThis.fetch = fetchMock;

    const cwf = await loadLLM({
      GEMINI_API_KEY: "test-gemini-key",
      OPENAI_API_KEY: "test-openai-key",
    });

    // First call: Gemini gets 429, falls back to OpenAI
    const result1 = await cwf("prompt 1");
    expect(result1.text).toBe("OpenAI after throttle");
    expect(result1.modelUsed).toBe("openai");

    // Second call: Gemini is throttled (returns {text:null, status:429} without fetch),
    // so it skips to OpenAI directly
    const result2 = await cwf("prompt 2");
    expect(result2.text).toBe("OpenAI still");
    expect(result2.modelUsed).toBe("openai");

    // Gemini was called once (the 429), then throttled on the second invocation.
    // OpenAI was called twice. Total fetch calls = 3.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  // ---- Both providers fail ----

  it("should return null text and null modelUsed when both providers fail", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    // Gemini 500
    fetchMock.mockResolvedValueOnce(mockResponse({ error: "server error" }, 500));
    // OpenAI 500
    fetchMock.mockResolvedValueOnce(mockResponse({ error: "server error" }, 500));
    globalThis.fetch = fetchMock;

    const cwf = await loadLLM({
      GEMINI_API_KEY: "test-gemini-key",
      OPENAI_API_KEY: "test-openai-key",
    });

    const result = await cwf("test prompt");

    expect(result.text).toBeNull();
    expect(result.modelUsed).toBeNull();
  });

  // ---- No API keys ----

  it("should return null when no API keys are configured", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    globalThis.fetch = fetchMock;

    const cwf = await loadLLM({
      GEMINI_API_KEY: undefined,
      OPENAI_API_KEY: undefined,
    });

    const result = await cwf("test prompt");

    expect(result.text).toBeNull();
    expect(result.modelUsed).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ---- Only OpenAI key set ----

  it("should skip Gemini and use OpenAI directly when only OPENAI_API_KEY is set", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        choices: [{ message: { content: "OpenAI only" } }],
      })
    );
    globalThis.fetch = fetchMock;

    const cwf = await loadLLM({
      GEMINI_API_KEY: undefined,
      OPENAI_API_KEY: "test-openai-key",
    });

    const result = await cwf("test prompt");

    expect(result.text).toBe("OpenAI only");
    expect(result.modelUsed).toBe("openai");
    expect(fetchMock).toHaveBeenCalledOnce();
    // Verify it called the OpenAI endpoint
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("api.openai.com");
  });

  // ---- Network error handling ----

  it("should handle fetch throwing a network error gracefully", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    // Gemini network error
    fetchMock.mockRejectedValueOnce(new Error("DNS resolution failed"));
    // OpenAI network error
    fetchMock.mockRejectedValueOnce(new Error("Connection refused"));
    globalThis.fetch = fetchMock;

    const cwf = await loadLLM({
      GEMINI_API_KEY: "test-gemini-key",
      OPENAI_API_KEY: "test-openai-key",
    });

    const result = await cwf("test prompt");

    expect(result.text).toBeNull();
    expect(result.modelUsed).toBeNull();
  });

  // ---- Request body verification ----

  it("should send the correct Gemini request payload", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(
      mockResponse({
        candidates: [{ content: { parts: [{ text: "ok" }] } }],
      })
    );
    globalThis.fetch = fetchMock;

    const cwf = await loadLLM({
      GEMINI_API_KEY: "test-gemini-key",
      OPENAI_API_KEY: undefined,
    });

    await cwf("summarize this", { maxTokens: 200, temperature: 0.7, topP: 0.8 });

    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0][1];
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "Content-Type": "application/json", "x-goog-api-key": "test-gemini-key" });

    const body = JSON.parse(init?.body as string) as {
      contents: Array<{ parts: Array<{ text: string }> }>;
      generationConfig: { maxOutputTokens: number; temperature: number; topP: number };
    };
    expect(body.contents[0].parts[0].text).toBe("summarize this");
    expect(body.generationConfig.maxOutputTokens).toBe(200);
    expect(body.generationConfig.temperature).toBe(0.7);
    expect(body.generationConfig.topP).toBe(0.8);
  });

  it("should send the correct OpenAI request payload", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(
      mockResponse({
        choices: [{ message: { content: "ok" } }],
      })
    );
    globalThis.fetch = fetchMock;

    const cwf = await loadLLM({
      GEMINI_API_KEY: undefined,
      OPENAI_API_KEY: "test-openai-key",
    });

    await cwf("summarize this", { maxTokens: 200, temperature: 0.7, topP: 0.8 });

    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0][1];
    expect(init?.method).toBe("POST");

    const headers = init?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-openai-key");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init?.body as string) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
      max_tokens: number;
      temperature: number;
      top_p: number;
    };
    expect(body.messages[0].content).toBe("summarize this");
    expect(body.max_tokens).toBe(200);
    expect(body.temperature).toBe(0.7);
    expect(body.top_p).toBe(0.8);
  });

  // ---- Gemini multi-part response ----

  it("should concatenate multi-part Gemini response", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(
      mockResponse({
        candidates: [
          {
            content: {
              parts: [{ text: "Part one. " }, { text: "Part two." }],
            },
          },
        ],
      })
    );
    globalThis.fetch = fetchMock;

    const cwf = await loadLLM({
      GEMINI_API_KEY: "test-gemini-key",
      OPENAI_API_KEY: undefined,
    });

    const result = await cwf("test");

    expect(result.text).toBe("Part one. Part two.");
    expect(result.modelUsed).toBe("gemini");
  });
});
