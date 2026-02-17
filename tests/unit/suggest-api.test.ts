/** Tests for AI suggestion route (POST /api/proposals/suggest). */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/llm", () => ({
  completeWithFallback: vi.fn(),
  isAiConfigured: vi.fn().mockReturnValue(true),
  isAiRateLimited: vi.fn().mockReturnValue(false),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 9, retryAfterMs: 0 }),
}));

import { POST } from "@/app/api/proposals/suggest/route";
import { requireAuth } from "@/lib/auth";
import { completeWithFallback, isAiConfigured, isAiRateLimited } from "@/lib/llm";

const mockedAuth = vi.mocked(requireAuth);
const mockedLLM = vi.mocked(completeWithFallback);
const mockedConfigured = vi.mocked(isAiConfigured);
const mockedRateLimited = vi.mocked(isAiRateLimited);

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

const okJson = (t: string, d = "D", s = "S") =>
  JSON.stringify([{ title: t, details: d, summary: s }]);

describe("POST /api/proposals/suggest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({ id: "u1", email: "t@e.com", role: "member" } as never);
  });

  describe("authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockedAuth.mockRejectedValue(new Error("Unauthorized"));
      const res = await POST(makeRequest(validBody));
      expect(res.status).toBe(401);
      expect((await res.json()).error).toBe("Unauthorized");
    });

    it("calls requireAuth before processing", async () => {
      mockedAuth.mockRejectedValue(new Error("Unauthorized"));
      await POST(makeRequest(validBody));
      expect(mockedAuth).toHaveBeenCalledOnce();
    });
  });

  describe("input validation", () => {
    it("returns 400 when project title is missing", async () => {
      const res = await POST(makeRequest({ project: { description: "no title" }, proposals: [] }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBeDefined();
    });

    it("returns 400 when project is missing entirely", async () => {
      const res = await POST(makeRequest({ proposals: [] }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when project title is empty string", async () => {
      const res = await POST(makeRequest({ project: { title: "", description: "d" }, proposals: [] }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when proposals array exceeds max length", async () => {
      const proposals = Array.from({ length: 101 }, (_, i) => ({ title: `P${i}` }));
      const res = await POST(makeRequest({ project: { title: "T", description: "D" }, proposals }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for non-object body", async () => {
      const res = await POST(makeRequest("not an object"));
      expect(res.status).toBe(400);
    });

    it("accepts valid body with defaults", async () => {
      mockedLLM.mockResolvedValue({ text: okJson("A"), modelUsed: "gemini" });
      const res = await POST(makeRequest({ project: { title: "T" } }));
      expect(res.status).toBe(200);
    });
  });

  describe("LLM call", () => {
    it("calls completeWithFallback with correct options", async () => {
      mockedLLM.mockResolvedValue({ text: okJson("A"), modelUsed: "gemini" });
      await POST(makeRequest(validBody));
      const [prompt, opts] = mockedLLM.mock.calls[0];
      expect(prompt).toContain("Weekend trips");
      expect(prompt).toContain("Places to visit near Cluj");
      expect(prompt).toContain("Existing idea");
      expect(opts).toEqual({ maxTokens: 2048, temperature: 0.65 });
    });

    it("includes locale in prompt", async () => {
      mockedLLM.mockResolvedValue({ text: okJson("A"), modelUsed: "gemini" });
      await POST(makeRequest({ ...validBody, locale: "ro" }));
      expect(mockedLLM.mock.calls[0][0]).toContain("ro");
    });

    it("handles empty proposals list in prompt", async () => {
      mockedLLM.mockResolvedValue({ text: okJson("A"), modelUsed: "gemini" });
      await POST(makeRequest({ project: { title: "Test", description: "Desc" }, proposals: [], locale: "en" }));
      expect(mockedLLM.mock.calls[0][0]).toContain("(none)");
    });
  });

  describe("successful suggestions", () => {
    it("returns parsed suggestions from clean JSON", async () => {
      const suggestions = [
        { title: "Idea 1", details: "## Details\n- step 1", summary: "Short summary" },
        { title: "Idea 2", details: "More details", summary: "Another summary" },
      ];
      mockedLLM.mockResolvedValue({ text: JSON.stringify(suggestions), modelUsed: "gemini" });
      const data = await (await POST(makeRequest(validBody))).json();
      expect(data.proposals).toHaveLength(2);
      expect(data.proposals[0].title).toBe("Idea 1");
      expect(data.proposals[1].summary).toBe("Another summary");
    });

    it("returns parsed suggestions from code-fenced JSON", async () => {
      mockedLLM.mockResolvedValue({
        text: "```json\n" + okJson("Fenced", "Details here", "Sum") + "\n```",
        modelUsed: "openai",
      });
      const data = await (await POST(makeRequest(validBody))).json();
      expect(data.proposals).toHaveLength(1);
      expect(data.proposals[0].title).toBe("Fenced");
    });

    it("limits to 3 suggestions maximum", async () => {
      const suggestions = Array.from({ length: 5 }, (_, i) => ({
        title: `Idea ${i}`, details: `D ${i}`, summary: `S ${i}`,
      }));
      mockedLLM.mockResolvedValue({ text: JSON.stringify(suggestions), modelUsed: "gemini" });
      const data = await (await POST(makeRequest(validBody))).json();
      expect(data.proposals).toHaveLength(3);
    });

    it("truncates title to 200 and summary to 240 chars", async () => {
      mockedLLM.mockResolvedValue({
        text: JSON.stringify([{ title: "T".repeat(300), details: "d", summary: "S".repeat(300) }]),
        modelUsed: "gemini",
      });
      const data = await (await POST(makeRequest(validBody))).json();
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
      const data = await (await POST(makeRequest(validBody))).json();
      expect(data.proposals).toHaveLength(1);
      expect(data.proposals[0].title).toBe("Valid");
    });
  });

  describe("graceful degradation", () => {
    it("returns 503 with NO_KEYS code when AI is not configured", async () => {
      mockedConfigured.mockReturnValue(false);
      const res = await POST(makeRequest(validBody));
      expect(res.status).toBe(503);
      expect((await res.json()).code).toBe("NO_KEYS");
      mockedConfigured.mockReturnValue(true);
    });

    it("returns 429 with RATE_LIMITED code when AI is rate limited", async () => {
      mockedRateLimited.mockReturnValue(true);
      const res = await POST(makeRequest(validBody));
      expect(res.status).toBe(429);
      expect((await res.json()).code).toBe("RATE_LIMITED");
      mockedRateLimited.mockReturnValue(false);
    });

    it("returns 503 with AI_UNAVAILABLE when LLM returns null text", async () => {
      mockedLLM.mockResolvedValue({ text: null, modelUsed: null });
      const res = await POST(makeRequest(validBody));
      expect(res.status).toBe(503);
      expect((await res.json()).code).toBe("AI_UNAVAILABLE");
    });
  });

  describe("retry on parse failure", () => {
    it("retries with stricter prompt when first parse returns empty", async () => {
      mockedLLM
        .mockResolvedValueOnce({ text: "Sorry, I can't help.", modelUsed: "gemini" })
        .mockResolvedValueOnce({ text: okJson("Retry"), modelUsed: "gemini" });
      const data = await (await POST(makeRequest(validBody))).json();
      expect(mockedLLM).toHaveBeenCalledTimes(2);
      expect(data.proposals).toHaveLength(1);
      expect(data.proposals[0].title).toBe("Retry");
    });

    it("uses lower temperature and strict prompt on retry", async () => {
      mockedLLM
        .mockResolvedValueOnce({ text: "no json here", modelUsed: "gemini" })
        .mockResolvedValueOnce({ text: "[]", modelUsed: "gemini" });
      await POST(makeRequest(validBody));
      const [retryPrompt, retryOpts] = mockedLLM.mock.calls[1];
      expect(retryOpts).toEqual({ maxTokens: 2048, temperature: 0.4 });
      expect(retryPrompt).toContain("IMPORTANT");
      expect(retryPrompt).toContain("raw JSON array");
    });

    it("returns empty proposals when both attempts fail to parse", async () => {
      mockedLLM
        .mockResolvedValueOnce({ text: "not json", modelUsed: "gemini" })
        .mockResolvedValueOnce({ text: "still not json", modelUsed: "gemini" });
      const data = await (await POST(makeRequest(validBody))).json();
      expect(data.proposals).toEqual([]);
      expect(mockedLLM).toHaveBeenCalledTimes(2);
    });

    it("does not retry when first parse succeeds", async () => {
      mockedLLM.mockResolvedValue({ text: okJson("A"), modelUsed: "gemini" });
      const data = await (await POST(makeRequest(validBody))).json();
      expect(data.proposals).toHaveLength(1);
      expect(mockedLLM).toHaveBeenCalledTimes(1);
    });

    it("returns empty when retry text is null", async () => {
      mockedLLM
        .mockResolvedValueOnce({ text: "no json", modelUsed: "gemini" })
        .mockResolvedValueOnce({ text: null, modelUsed: null });
      const data = await (await POST(makeRequest(validBody))).json();
      expect(data.proposals).toEqual([]);
    });
  });

  describe("LLM failure handling", () => {
    it("returns 500 when LLM throws an exception", async () => {
      mockedLLM.mockRejectedValue(new Error("Network timeout"));
      const res = await POST(makeRequest(validBody));
      expect(res.status).toBe(500);
      expect((await res.json()).error).toBe("Failed to generate suggestions");
    });

    it("returns 503 when LLM returns empty string", async () => {
      mockedLLM.mockResolvedValue({ text: "", modelUsed: "gemini" });
      expect((await POST(makeRequest(validBody))).status).toBe(503);
    });
  });

  describe("edge cases", () => {
    it("handles LLM output with extra text around JSON", async () => {
      mockedLLM.mockResolvedValue({
        text: 'Here are my suggestions:\n[{"title":"A","details":"B","summary":"C"}]\nHope this helps!',
        modelUsed: "openai",
      });
      const data = await (await POST(makeRequest(validBody))).json();
      expect(data.proposals).toHaveLength(1);
      expect(data.proposals[0].title).toBe("A");
    });

    it("handles project with very long description", async () => {
      mockedLLM.mockResolvedValue({ text: okJson("A", "B", "C"), modelUsed: "gemini" });
      const res = await POST(makeRequest({
        project: { title: "Test", description: "D".repeat(5000) },
        proposals: [],
      }));
      expect(res.status).toBe(200);
      expect(mockedLLM.mock.calls[0][0]).toContain("D".repeat(100));
    });

    it("rejects description exceeding max length", async () => {
      const res = await POST(makeRequest({
        project: { title: "Test", description: "D".repeat(5001) },
        proposals: [],
      }));
      expect(res.status).toBe(400);
    });
  });
});
