import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockSearch = vi.fn();

vi.mock("@/lib/search", () => ({
  search: (...args: unknown[]) => mockSearch(...args),
}));

// ── Import SUT ─────────────────────────────────────────────────────────────

import { GET } from "@/app/api/search/route";

// ── Test helpers ───────────────────────────────────────────────────────────

function createRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockSearch.mockClear();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Search API Route", () => {
  describe("GET /api/search", () => {
    it("should return empty results for empty query", async () => {
      const request = createRequest("/api/search?q=");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ results: [], query: "" });
      expect(mockSearch).not.toHaveBeenCalled();
    });

    it("should return empty results for query shorter than 2 characters", async () => {
      const request = createRequest("/api/search?q=a");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ results: [], query: "a" });
      expect(mockSearch).not.toHaveBeenCalled();
    });

    it("should return search results for valid query", async () => {
      const mockResults = [
        {
          id: "proj-1",
          title: "React Migration",
          description: "Migrate to React 18",
          type: "project",
          snippet: "<mark>React</mark> Migration",
        },
        {
          id: "prop-1",
          title: "Use React Hooks",
          description: null,
          type: "proposal",
          snippet: "Use <mark>React</mark> Hooks",
        },
      ];

      mockSearch.mockReturnValue(mockResults);

      const request = createRequest("/api/search?q=React");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        results: mockResults,
        query: "React",
      });
      expect(mockSearch).toHaveBeenCalledWith("React", 20);
    });

    it("should use default limit of 20", async () => {
      mockSearch.mockReturnValue([]);

      const request = createRequest("/api/search?q=test");

      await GET(request);

      expect(mockSearch).toHaveBeenCalledWith("test", 20);
    });

    it("should respect custom limit parameter", async () => {
      mockSearch.mockReturnValue([]);

      const request = createRequest("/api/search?q=test&limit=10");

      await GET(request);

      expect(mockSearch).toHaveBeenCalledWith("test", 10);
    });

    it("should cap limit at 50", async () => {
      mockSearch.mockReturnValue([]);

      const request = createRequest("/api/search?q=test&limit=100");

      await GET(request);

      expect(mockSearch).toHaveBeenCalledWith("test", 50);
    });

    it("should handle invalid limit parameter", async () => {
      mockSearch.mockReturnValue([]);

      const request = createRequest("/api/search?q=test&limit=invalid");

      await GET(request);

      // Should fall back to default limit (NaN becomes default)
      expect(mockSearch).toHaveBeenCalledWith("test", 20);
    });

    it("should handle negative limit parameter", async () => {
      mockSearch.mockReturnValue([]);

      const request = createRequest("/api/search?q=test&limit=-5");

      await GET(request);

      // Math.min will use the negative value, but search should handle it
      expect(mockSearch).toHaveBeenCalledWith("test", -5);
    });

    it("should handle missing query parameter", async () => {
      const request = createRequest("/api/search");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ results: [], query: "" });
      expect(mockSearch).not.toHaveBeenCalled();
    });

    it("should handle search errors gracefully", async () => {
      mockSearch.mockImplementation(() => {
        throw new Error("Database error");
      });

      const request = createRequest("/api/search?q=test");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: "Search failed" });
    });

    it("should handle search timeout errors", async () => {
      mockSearch.mockImplementation(() => {
        throw new Error("SQLITE_BUSY");
      });

      const request = createRequest("/api/search?q=test");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: "Search failed" });
    });

    it("should handle multi-word queries", async () => {
      mockSearch.mockReturnValue([]);

      const request = createRequest("/api/search?q=react+hooks+migration");

      await GET(request);

      expect(mockSearch).toHaveBeenCalledWith("react hooks migration", 20);
    });

    it("should handle URL-encoded queries", async () => {
      mockSearch.mockReturnValue([]);

      const request = createRequest("/api/search?q=hello%20world");

      await GET(request);

      expect(mockSearch).toHaveBeenCalledWith("hello world", 20);
    });

    it("should handle special characters in query", async () => {
      mockSearch.mockReturnValue([]);

      const request = createRequest("/api/search?q=C%2B%2B");

      await GET(request);

      expect(mockSearch).toHaveBeenCalledWith("C++", 20);
    });

    it("should preserve query in response", async () => {
      mockSearch.mockReturnValue([]);

      const request = createRequest("/api/search?q=my%20search%20term");

      const response = await GET(request);
      const data = await response.json();

      expect(data.query).toBe("my search term");
    });

    it("should return project results", async () => {
      const mockResults = [
        {
          id: "proj-1",
          title: "Q4 Roadmap",
          description: "Planning for Q4",
          type: "project",
          snippet: "Q4 <mark>Roadmap</mark>",
        },
      ];

      mockSearch.mockReturnValue(mockResults);

      const request = createRequest("/api/search?q=roadmap");

      const response = await GET(request);
      const data = await response.json();

      expect(data.results[0].type).toBe("project");
    });

    it("should return proposal results", async () => {
      const mockResults = [
        {
          id: "prop-1",
          title: "Add dark mode",
          description: "Implement dark mode",
          type: "proposal",
          snippet: "Add <mark>dark</mark> mode",
        },
      ];

      mockSearch.mockReturnValue(mockResults);

      const request = createRequest("/api/search?q=dark");

      const response = await GET(request);
      const data = await response.json();

      expect(data.results[0].type).toBe("proposal");
    });

    it("should return mixed project and proposal results", async () => {
      const mockResults = [
        {
          id: "proj-1",
          title: "Test Project",
          description: null,
          type: "project",
          snippet: "<mark>Test</mark> Project",
        },
        {
          id: "prop-1",
          title: "Test Proposal",
          description: null,
          type: "proposal",
          snippet: "<mark>Test</mark> Proposal",
        },
      ];

      mockSearch.mockReturnValue(mockResults);

      const request = createRequest("/api/search?q=test");

      const response = await GET(request);
      const data = await response.json();

      expect(data.results).toHaveLength(2);
      expect(data.results[0].type).toBe("project");
      expect(data.results[1].type).toBe("proposal");
    });

    it("should handle queries with whitespace", async () => {
      mockSearch.mockReturnValue([]);

      const request = createRequest("/api/search?q=%20%20");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results).toEqual([]);
      // "  " has length 2 so it passes the min-length check
      // but search() itself returns empty for whitespace
    });

    it("should handle very long queries", async () => {
      const longQuery = "a".repeat(1000);
      mockSearch.mockReturnValue([]);

      const request = createRequest(
        `/api/search?q=${encodeURIComponent(longQuery)}`
      );

      await GET(request);

      expect(mockSearch).toHaveBeenCalledWith(longQuery, 20);
    });

    it("should return 200 for successful search even with no results", async () => {
      mockSearch.mockReturnValue([]);

      const request = createRequest("/api/search?q=nonexistent");

      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("should handle zero limit", async () => {
      mockSearch.mockReturnValue([]);

      const request = createRequest("/api/search?q=test&limit=0");

      await GET(request);

      expect(mockSearch).toHaveBeenCalledWith("test", 0);
    });

    it("should parse limit as integer", async () => {
      mockSearch.mockReturnValue([]);

      const request = createRequest("/api/search?q=test&limit=10.5");

      await GET(request);

      expect(mockSearch).toHaveBeenCalledWith("test", 10);
    });
  });
});
