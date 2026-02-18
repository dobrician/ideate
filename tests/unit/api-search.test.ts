import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockSearch = vi.fn();
const mockGetCurrentUser = vi.fn();
const mockCheckRateLimit = vi.fn().mockReturnValue({ allowed: true, remaining: 59, retryAfterMs: 0 });

vi.mock("@/lib/search", () => ({ search: (...a: unknown[]) => mockSearch(...a) }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: () => mockGetCurrentUser() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => mockCheckRateLimit(...a) }));

// ── Import SUT ─────────────────────────────────────────────────────────────

import { GET } from "@/app/api/search/route";

// ── Helpers ────────────────────────────────────────────────────────────────

function req(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

const mockUser = { id: "user-1", email: "test@example.com", role: "member" };

beforeEach(() => {
  mockSearch.mockClear();
  mockGetCurrentUser.mockReset();
  mockGetCurrentUser.mockResolvedValue(mockUser);
  mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 59, retryAfterMs: 0 });
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Search API Route", () => {
  describe("GET /api/search", () => {
    it("should return 401 when not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const response = await GET(req("/api/search?q=test"));
      expect(response.status).toBe(401);
      expect((await response.json()).error).toBe("Unauthorized");
    });

    it("should return 429 when rate-limited", async () => {
      mockCheckRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, retryAfterMs: 60000 });
      const response = await GET(req("/api/search?q=test"));
      const data = await response.json();
      expect(response.status).toBe(429);
      expect(data.error).toBe("Too many requests");
      expect(response.headers.get("Retry-After")).toBe("60");
    });

    it("should return empty results for empty query", async () => {
      const response = await GET(req("/api/search?q="));
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toEqual({ results: [], query: "" });
      expect(mockSearch).not.toHaveBeenCalled();
    });

    it("should return empty results for query shorter than 2 chars", async () => {
      const response = await GET(req("/api/search?q=a"));
      expect(response.status).toBe(200);
      expect((await response.json())).toEqual({ results: [], query: "a" });
      expect(mockSearch).not.toHaveBeenCalled();
    });

    it("should return search results for valid query", async () => {
      const mockResults = [
        { id: "proj-1", title: "React Migration", description: "Migrate to React 18", type: "project", snippet: "<mark>React</mark> Migration" },
        { id: "prop-1", title: "Use React Hooks", description: null, type: "proposal", snippet: "Use <mark>React</mark> Hooks" },
      ];
      mockSearch.mockReturnValue(mockResults);
      const response = await GET(req("/api/search?q=React"));
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toEqual({ results: mockResults, query: "React" });
      expect(mockSearch).toHaveBeenCalledWith("React", 20);
    });

    it("should use default limit of 20", async () => {
      mockSearch.mockReturnValue([]);
      await GET(req("/api/search?q=test"));
      expect(mockSearch).toHaveBeenCalledWith("test", 20);
    });

    it("should respect custom limit parameter", async () => {
      mockSearch.mockReturnValue([]);
      await GET(req("/api/search?q=test&limit=10"));
      expect(mockSearch).toHaveBeenCalledWith("test", 10);
    });

    it("should cap limit at 50", async () => {
      mockSearch.mockReturnValue([]);
      await GET(req("/api/search?q=test&limit=100"));
      expect(mockSearch).toHaveBeenCalledWith("test", 50);
    });

    it("should handle invalid limit parameter", async () => {
      mockSearch.mockReturnValue([]);
      await GET(req("/api/search?q=test&limit=invalid"));
      expect(mockSearch).toHaveBeenCalledWith("test", 20);
    });

    it("should handle negative limit parameter", async () => {
      mockSearch.mockReturnValue([]);
      await GET(req("/api/search?q=test&limit=-5"));
      expect(mockSearch).toHaveBeenCalledWith("test", -5);
    });

    it("should handle missing query parameter", async () => {
      const response = await GET(req("/api/search"));
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toEqual({ results: [], query: "" });
      expect(mockSearch).not.toHaveBeenCalled();
    });

    it("should handle search errors gracefully", async () => {
      mockSearch.mockImplementation(() => { throw new Error("Database error"); });
      const response = await GET(req("/api/search?q=test"));
      expect(response.status).toBe(500);
      expect((await response.json())).toEqual({ error: "Search failed" });
    });

    it("should handle search timeout errors", async () => {
      mockSearch.mockImplementation(() => { throw new Error("SQLITE_BUSY"); });
      const response = await GET(req("/api/search?q=test"));
      expect(response.status).toBe(500);
      expect((await response.json())).toEqual({ error: "Search failed" });
    });

    it("should handle multi-word queries", async () => {
      mockSearch.mockReturnValue([]);
      await GET(req("/api/search?q=react+hooks+migration"));
      expect(mockSearch).toHaveBeenCalledWith("react hooks migration", 20);
    });

    it("should handle URL-encoded queries", async () => {
      mockSearch.mockReturnValue([]);
      await GET(req("/api/search?q=hello%20world"));
      expect(mockSearch).toHaveBeenCalledWith("hello world", 20);
    });

    it("should handle special characters in query", async () => {
      mockSearch.mockReturnValue([]);
      await GET(req("/api/search?q=C%2B%2B"));
      expect(mockSearch).toHaveBeenCalledWith("C++", 20);
    });

    it("should preserve query in response", async () => {
      mockSearch.mockReturnValue([]);
      const response = await GET(req("/api/search?q=my%20search%20term"));
      expect((await response.json()).query).toBe("my search term");
    });

    it("should return project results", async () => {
      mockSearch.mockReturnValue([
        { id: "proj-1", title: "Q4 Roadmap", description: "Planning for Q4", type: "project", snippet: "Q4 <mark>Roadmap</mark>" },
      ]);
      const response = await GET(req("/api/search?q=roadmap"));
      expect((await response.json()).results[0].type).toBe("project");
    });

    it("should return proposal results", async () => {
      mockSearch.mockReturnValue([
        { id: "prop-1", title: "Add dark mode", description: "Implement dark mode", type: "proposal", snippet: "Add <mark>dark</mark> mode" },
      ]);
      const response = await GET(req("/api/search?q=dark"));
      expect((await response.json()).results[0].type).toBe("proposal");
    });

    it("should return mixed project and proposal results", async () => {
      mockSearch.mockReturnValue([
        { id: "proj-1", title: "Test Project", description: null, type: "project", snippet: "<mark>Test</mark> Project" },
        { id: "prop-1", title: "Test Proposal", description: null, type: "proposal", snippet: "<mark>Test</mark> Proposal" },
      ]);
      const response = await GET(req("/api/search?q=test"));
      const data = await response.json();
      expect(data.results).toHaveLength(2);
      expect(data.results[0].type).toBe("project");
      expect(data.results[1].type).toBe("proposal");
    });

    it("should handle queries with whitespace", async () => {
      mockSearch.mockReturnValue([]);
      const response = await GET(req("/api/search?q=%20%20"));
      expect(response.status).toBe(200);
      expect((await response.json()).results).toEqual([]);
    });

    it("should handle very long queries", async () => {
      const longQuery = "a".repeat(1000);
      mockSearch.mockReturnValue([]);
      await GET(req(`/api/search?q=${encodeURIComponent(longQuery)}`));
      expect(mockSearch).toHaveBeenCalledWith(longQuery, 20);
    });

    it("should return 200 for successful search even with no results", async () => {
      mockSearch.mockReturnValue([]);
      const response = await GET(req("/api/search?q=nonexistent"));
      expect(response.status).toBe(200);
    });

    it("should handle zero limit", async () => {
      mockSearch.mockReturnValue([]);
      await GET(req("/api/search?q=test&limit=0"));
      expect(mockSearch).toHaveBeenCalledWith("test", 0);
    });

    it("should parse limit as integer", async () => {
      mockSearch.mockReturnValue([]);
      await GET(req("/api/search?q=test&limit=10.5"));
      expect(mockSearch).toHaveBeenCalledWith("test", 10);
    });
  });
});
