/** Tests for POST /api/proposals/similarity route handler. */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/llm", () => ({
  completeWithFallback: vi.fn(),
}));

import { POST } from "@/app/api/proposals/similarity/route";
import { requireAuth } from "@/lib/auth";
import { completeWithFallback } from "@/lib/llm";

const mockedAuth = vi.mocked(requireAuth);
const mockedLLM = vi.mocked(completeWithFallback);

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/proposals/similarity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  project: { title: "Test Project", description: "A test project" },
  existing: [{ id: "p1", title: "Existing proposal", description: "Details" }],
  proposal: { title: "New proposal", description: "New details" },
};

describe("POST /api/proposals/similarity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({ id: "u1", email: "t@e.com", role: "member" } as never);
  });

  describe("authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockedAuth.mockRejectedValue(new Error("Unauthorized"));
      const res = await POST(makeRequest(validBody));
      expect(res.status).toBe(401);
    });
  });

  describe("Zod validation", () => {
    it("returns 400 for non-object body", async () => {
      const res = await POST(makeRequest("not an object"));
      expect(res.status).toBe(400);
    });

    it("returns 400 when project title is missing", async () => {
      const res = await POST(makeRequest({
        project: { description: "no title" },
        existing: [{ id: "p1", title: "E" }],
        proposal: { title: "N" },
      }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when proposal title is missing", async () => {
      const res = await POST(makeRequest({
        project: { title: "T", description: "D" },
        existing: [{ id: "p1", title: "E" }],
        proposal: { description: "no title" },
      }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when existing array exceeds max length", async () => {
      const existing = Array.from({ length: 101 }, (_, i) => ({ id: `p${i}`, title: `P${i}` }));
      const res = await POST(makeRequest({
        project: { title: "T", description: "D" },
        existing,
        proposal: { title: "N" },
      }));
      expect(res.status).toBe(400);
    });

    it("returns empty matches when existing array is empty", async () => {
      const res = await POST(makeRequest({
        project: { title: "T", description: "D" },
        existing: [],
        proposal: { title: "N" },
      }));
      expect(res.status).toBe(200);
      expect((await res.json()).matches).toEqual([]);
    });
  });

  describe("LLM integration", () => {
    it("returns matches from LLM response", async () => {
      mockedLLM.mockResolvedValue({
        text: JSON.stringify({ p1: { similarity: 75, explanation: "Similar features" } }),
        modelUsed: "gemini",
      });
      const res = await POST(makeRequest(validBody));
      const data = await res.json();
      expect(data.matches).toHaveLength(1);
      expect(data.matches[0].similarity).toBe(75);
    });

    it("falls back to Jaccard when LLM returns null", async () => {
      mockedLLM.mockResolvedValue({ text: null, modelUsed: null });
      const res = await POST(makeRequest(validBody));
      const data = await res.json();
      expect(data.matches).toHaveLength(1);
      expect(typeof data.matches[0].similarity).toBe("number");
    });

    it("falls back to Jaccard when LLM output is unparseable", async () => {
      mockedLLM.mockResolvedValue({ text: "not json at all", modelUsed: "gemini" });
      const res = await POST(makeRequest(validBody));
      const data = await res.json();
      expect(data.matches).toHaveLength(1);
    });

    it("returns 500 when LLM throws", async () => {
      mockedLLM.mockRejectedValue(new Error("Network error"));
      const res = await POST(makeRequest(validBody));
      expect(res.status).toBe(500);
    });
  });
});
