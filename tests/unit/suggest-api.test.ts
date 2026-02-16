/**
 * Tests for AI suggestion route (POST /api/proposals/suggest).
 *
 * Strategy:
 *  - Mock `@/lib/auth` (requireAuth) to control auth state
 *  - Mock `@/lib/llm` (completeWithFallback) to control AI responses
 *  - Test the actual route handler: auth checks, input validation,
 *    prompt construction, response parsing, error handling
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/llm", () => ({
  completeWithFallback: vi.fn(),
}));

import { POST } from "@/app/api/proposals/suggest/route";
import { requireAuth } from "@/lib/auth";
import { completeWithFallback } from "@/lib/llm";

const mockedAuth = vi.mocked(requireAuth);
const mockedLLM = vi.mocked(completeWithFallback);

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/proposals/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  project: { title: "Weekend trips", description: "Places to visit near Cluj" },
  proposals: [{ title: "Existing idea", description: "Already proposed" }],
  locale: "ro",
};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

describe("POST /api/proposals/suggest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({ id: "user-1", email: "test@example.com", role: "member" } as never);
  });

  describe("authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockedAuth.mockRejectedValue(new Error("Unauthorized"));

      const res = await POST(makeRequest(validBody));
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("calls requireAuth before processing", async () => {
      mockedAuth.mockRejectedValue(new Error("Unauthorized"));
      await POST(makeRequest(validBody));
      expect(mockedAuth).toHaveBeenCalledOnce();
    });
  });

  // ---------------------------------------------------------------------------
  // Input validation
  // ---------------------------------------------------------------------------

  describe("input validation", () => {
    it("returns 400 when project title is missing", async () => {
      const res = await POST(
        makeRequest({ project: { description: "no title" }, proposals: [] })
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("title");
    });

    it("returns 400 when project is missing entirely", async () => {
      const res = await POST(makeRequest({ proposals: [] }));
      expect(res.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // LLM integration
  // ---------------------------------------------------------------------------

  describe("LLM call", () => {
    it("calls completeWithFallback with correct options", async () => {
      mockedLLM.mockResolvedValue({ text: "[]", modelUsed: "gemini" });

      await POST(makeRequest(validBody));

      expect(mockedLLM).toHaveBeenCalledOnce();
      const [prompt, opts] = mockedLLM.mock.calls[0];
      expect(prompt).toContain("Weekend trips");
      expect(prompt).toContain("Places to visit near Cluj");
      expect(prompt).toContain("Existing idea");
      expect(opts).toEqual({ maxTokens: 600, temperature: 0.65 });
    });

    it("includes locale in prompt", async () => {
      mockedLLM.mockResolvedValue({ text: "[]", modelUsed: "gemini" });

      await POST(makeRequest({ ...validBody, locale: "ro" }));

      const [prompt] = mockedLLM.mock.calls[0];
      expect(prompt).toContain("ro");
    });

    it("handles empty proposals list in prompt", async () => {
      mockedLLM.mockResolvedValue({ text: "[]", modelUsed: "gemini" });

      await POST(
        makeRequest({
          project: { title: "Test", description: "Desc" },
          proposals: [],
          locale: "en",
        })
      );

      const [prompt] = mockedLLM.mock.calls[0];
      expect(prompt).toContain("(none)");
    });
  });

  // ---------------------------------------------------------------------------
  // Response parsing — valid LLM outputs
  // ---------------------------------------------------------------------------

  describe("successful suggestions", () => {
    it("returns parsed suggestions from clean JSON", async () => {
      const suggestions = [
        { title: "Idea 1", details: "## Details\n- step 1", summary: "Short summary" },
        { title: "Idea 2", details: "More details", summary: "Another summary" },
      ];
      mockedLLM.mockResolvedValue({
        text: JSON.stringify(suggestions),
        modelUsed: "gemini",
      });

      const res = await POST(makeRequest(validBody));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.proposals).toHaveLength(2);
      expect(data.proposals[0].title).toBe("Idea 1");
      expect(data.proposals[1].summary).toBe("Another summary");
    });

    it("returns parsed suggestions from code-fenced JSON", async () => {
      const suggestions = [
        { title: "Fenced", details: "Details here", summary: "Sum" },
      ];
      mockedLLM.mockResolvedValue({
        text: "```json\n" + JSON.stringify(suggestions) + "\n```",
        modelUsed: "openai",
      });

      const res = await POST(makeRequest(validBody));
      const data = await res.json();
      expect(data.proposals).toHaveLength(1);
      expect(data.proposals[0].title).toBe("Fenced");
    });

    it("limits to 3 suggestions maximum", async () => {
      const suggestions = Array.from({ length: 5 }, (_, i) => ({
        title: `Idea ${i}`,
        details: `Details ${i}`,
        summary: `Summary ${i}`,
      }));
      mockedLLM.mockResolvedValue({
        text: JSON.stringify(suggestions),
        modelUsed: "gemini",
      });

      const res = await POST(makeRequest(validBody));
      const data = await res.json();
      expect(data.proposals).toHaveLength(3);
    });

    it("truncates title to 200 and summary to 240 chars", async () => {
      mockedLLM.mockResolvedValue({
        text: JSON.stringify([{
          title: "T".repeat(300),
          details: "details",
          summary: "S".repeat(300),
        }]),
        modelUsed: "gemini",
      });

      const res = await POST(makeRequest(validBody));
      const data = await res.json();
      expect(data.proposals[0].title).toHaveLength(200);
      expect(data.proposals[0].summary).toHaveLength(240);
    });

    it("filters out objects missing required fields", async () => {
      mockedLLM.mockResolvedValue({
        text: JSON.stringify([
          { title: "Valid", details: "D", summary: "S" },
          { title: "No summary", details: "D" },
          { title: "No details" },
        ]),
        modelUsed: "gemini",
      });

      const res = await POST(makeRequest(validBody));
      const data = await res.json();
      expect(data.proposals).toHaveLength(1);
      expect(data.proposals[0].title).toBe("Valid");
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling — LLM failures
  // ---------------------------------------------------------------------------

  describe("LLM failure handling", () => {
    it("returns empty proposals when LLM returns null text", async () => {
      mockedLLM.mockResolvedValue({ text: null, modelUsed: null });

      const res = await POST(makeRequest(validBody));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.proposals).toEqual([]);
    });

    it("returns empty proposals when LLM returns non-JSON", async () => {
      mockedLLM.mockResolvedValue({
        text: "I cannot generate suggestions right now.",
        modelUsed: "gemini",
      });

      const res = await POST(makeRequest(validBody));
      const data = await res.json();
      expect(data.proposals).toEqual([]);
    });

    it("returns empty proposals when LLM returns malformed JSON", async () => {
      mockedLLM.mockResolvedValue({
        text: "[{invalid json",
        modelUsed: "gemini",
      });

      const res = await POST(makeRequest(validBody));
      const data = await res.json();
      expect(data.proposals).toEqual([]);
    });

    it("returns 500 when LLM throws an exception", async () => {
      mockedLLM.mockRejectedValue(new Error("Network timeout"));

      const res = await POST(makeRequest(validBody));
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe("Failed to generate suggestions");
    });

    it("returns empty proposals when LLM returns empty string", async () => {
      mockedLLM.mockResolvedValue({ text: "", modelUsed: "gemini" });

      const res = await POST(makeRequest(validBody));
      const data = await res.json();
      // empty string is falsy, so route returns { proposals: [] }
      expect(data.proposals).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe("edge cases", () => {
    it("handles LLM output with extra text around JSON", async () => {
      mockedLLM.mockResolvedValue({
        text: 'Here are my suggestions:\n[{"title":"A","details":"B","summary":"C"}]\nHope this helps!',
        modelUsed: "openai",
      });

      const res = await POST(makeRequest(validBody));
      const data = await res.json();
      expect(data.proposals).toHaveLength(1);
      expect(data.proposals[0].title).toBe("A");
    });

    it("handles project with very long description", async () => {
      mockedLLM.mockResolvedValue({
        text: '[{"title":"A","details":"B","summary":"C"}]',
        modelUsed: "gemini",
      });

      const res = await POST(
        makeRequest({
          project: { title: "Test", description: "D".repeat(10000) },
          proposals: [],
        })
      );
      expect(res.status).toBe(200);
      const [prompt] = mockedLLM.mock.calls[0];
      expect(prompt).toContain("D".repeat(100));
    });
  });
});
