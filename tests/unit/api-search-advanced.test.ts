import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockGetCurrentUser = vi.fn();
const mockCheckRateLimit = vi.fn().mockReturnValue({ allowed: true, remaining: 59, retryAfterMs: 0 });
const mockGetSuggestions = vi.fn();
const mockTrackSearchClick = vi.fn();
const mockGetUserSavedSearches = vi.fn();
const mockCreateSavedSearch = vi.fn();
const mockDeleteSavedSearch = vi.fn();
const mockSearch = vi.fn();
const mockFilteredSearch = vi.fn();
const mockGetClientIp = vi.fn().mockReturnValue("127.0.0.1");

vi.mock("@/lib/auth", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...a: unknown[]) => mockCheckRateLimit(...a),
}));

vi.mock("@/lib/search", () => ({
  getSuggestions: (...a: unknown[]) => mockGetSuggestions(...a),
  trackSearchClick: (...a: unknown[]) => mockTrackSearchClick(...a),
  getUserSavedSearches: (...a: unknown[]) => mockGetUserSavedSearches(...a),
  createSavedSearch: (...a: unknown[]) => mockCreateSavedSearch(...a),
  deleteSavedSearch: (...a: unknown[]) => mockDeleteSavedSearch(...a),
  search: (...a: unknown[]) => mockSearch(...a),
  filteredSearch: (...a: unknown[]) => mockFilteredSearch(...a),
}));

vi.mock("@/lib/request-utils", () => ({
  getClientIp: (...a: unknown[]) => mockGetClientIp(...a),
}));

// ── Import SUTs ────────────────────────────────────────────────────────────

import { GET as suggestionsGET } from "@/app/api/search/suggestions/route";
import { POST as clickPOST } from "@/app/api/search/click/route";
import { GET as savedGET, POST as savedPOST, DELETE as savedDELETE } from "@/app/api/search/saved/route";
import { GET as exportGET } from "@/app/api/search/export/route";

// ── Helpers ────────────────────────────────────────────────────────────────

function req(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

function jsonReq(url: string, body: unknown) {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const mockUser = { id: "user-1", email: "test@example.com", role: "member" };

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue(mockUser);
  mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 59, retryAfterMs: 0 });
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Search API Routes — Advanced", () => {
  // ── GET /api/search/suggestions ─────────────────────────────────────────

  describe("GET /api/search/suggestions", () => {
    it("should return 401 when not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const response = await suggestionsGET(req("/api/search/suggestions?q=react"));

      expect(response.status).toBe(401);
      expect((await response.json()).error).toBe("Unauthorized");
    });

    it("should return 429 when rate-limited", async () => {
      mockCheckRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, retryAfterMs: 60000 });

      const response = await suggestionsGET(req("/api/search/suggestions?q=react"));

      expect(response.status).toBe(429);
      expect((await response.json()).error).toBe("Too many requests");
    });

    it("should return empty suggestions for empty query", async () => {
      const response = await suggestionsGET(req("/api/search/suggestions?q="));

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toEqual({ suggestions: [] });
      expect(mockGetSuggestions).not.toHaveBeenCalled();
    });

    it("should return suggestions for valid prefix", async () => {
      mockGetSuggestions.mockResolvedValue([
        { text: "react hooks", type: "popular", frequency: 50 },
        { text: "react native", type: "popular", frequency: 30 },
      ]);

      const response = await suggestionsGET(req("/api/search/suggestions?q=react"));

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.suggestions).toHaveLength(2);
      expect(data.suggestions[0].text).toBe("react hooks");
    });

    it("should pass limit of 8 to getSuggestions", async () => {
      mockGetSuggestions.mockResolvedValue([]);

      await suggestionsGET(req("/api/search/suggestions?q=test"));

      expect(mockGetSuggestions).toHaveBeenCalledWith("test", 8);
    });

    it("should allow single character query", async () => {
      mockGetSuggestions.mockResolvedValue([{ text: "a-suggestion", type: "popular" }]);

      const response = await suggestionsGET(req("/api/search/suggestions?q=a"));

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(mockGetSuggestions).toHaveBeenCalledWith("a", 8);
    });

    it("should handle missing q parameter", async () => {
      const response = await suggestionsGET(req("/api/search/suggestions"));

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.suggestions).toEqual([]);
    });
  });

  // ── POST /api/search/click ──────────────────────────────────────────────

  describe("POST /api/search/click", () => {
    it("should return 401 when not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const response = await clickPOST(
        jsonReq("/api/search/click", {
          analyticsId: "a1",
          resultId: "r1",
          resultType: "project",
        })
      );

      expect(response.status).toBe(401);
    });

    it("should track click and return ok", async () => {
      mockTrackSearchClick.mockResolvedValue(undefined);

      const response = await clickPOST(
        jsonReq("/api/search/click", {
          analyticsId: "analytics-1",
          resultId: "result-1",
          resultType: "project",
        })
      );

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(mockTrackSearchClick).toHaveBeenCalledWith("analytics-1", "result-1", "project");
    });

    it("should return 400 when analyticsId is missing", async () => {
      const response = await clickPOST(
        jsonReq("/api/search/click", {
          resultId: "r1",
          resultType: "project",
        })
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("Missing required fields");
    });

    it("should return 400 when resultId is missing", async () => {
      const response = await clickPOST(
        jsonReq("/api/search/click", {
          analyticsId: "a1",
          resultType: "project",
        })
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("Missing required fields");
    });

    it("should return 400 when resultType is missing", async () => {
      const response = await clickPOST(
        jsonReq("/api/search/click", {
          analyticsId: "a1",
          resultId: "r1",
        })
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("Missing required fields");
    });

    it("should return 400 for invalid result type", async () => {
      const response = await clickPOST(
        jsonReq("/api/search/click", {
          analyticsId: "a1",
          resultId: "r1",
          resultType: "invalid",
        })
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("Invalid result type");
    });

    it("should accept 'proposal' result type", async () => {
      mockTrackSearchClick.mockResolvedValue(undefined);

      const response = await clickPOST(
        jsonReq("/api/search/click", {
          analyticsId: "a1",
          resultId: "r1",
          resultType: "proposal",
        })
      );

      expect(response.status).toBe(200);
    });

    it("should accept 'comment' result type", async () => {
      mockTrackSearchClick.mockResolvedValue(undefined);

      const response = await clickPOST(
        jsonReq("/api/search/click", {
          analyticsId: "a1",
          resultId: "r1",
          resultType: "comment",
        })
      );

      expect(response.status).toBe(200);
    });

    it("should return 500 when trackSearchClick throws", async () => {
      mockTrackSearchClick.mockRejectedValue(new Error("DB error"));

      const response = await clickPOST(
        jsonReq("/api/search/click", {
          analyticsId: "a1",
          resultId: "r1",
          resultType: "project",
        })
      );

      expect(response.status).toBe(500);
      expect((await response.json()).error).toBe("Failed to track click");
    });
  });

  // ── GET /api/search/saved ───────────────────────────────────────────────

  describe("GET /api/search/saved", () => {
    it("should return 401 when not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const response = await savedGET();

      expect(response.status).toBe(401);
      expect((await response.json()).error).toBe("Unauthorized");
    });

    it("should return user saved searches", async () => {
      mockGetUserSavedSearches.mockResolvedValue([
        { id: "ss-1", name: "React", query: "react", mode: "fts" },
        { id: "ss-2", name: "TS", query: "typescript", mode: "semantic" },
      ]);

      const response = await savedGET();

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.searches).toHaveLength(2);
      expect(mockGetUserSavedSearches).toHaveBeenCalledWith("user-1");
    });

    it("should return empty array when no saved searches", async () => {
      mockGetUserSavedSearches.mockResolvedValue([]);

      const response = await savedGET();

      const data = await response.json();
      expect(data.searches).toEqual([]);
    });
  });

  // ── POST /api/search/saved ──────────────────────────────────────────────

  describe("POST /api/search/saved", () => {
    it("should return 401 when not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const response = await savedPOST(
        jsonReq("/api/search/saved", { name: "Test", query: "react" })
      );

      expect(response.status).toBe(401);
    });

    it("should create saved search and return 201", async () => {
      const savedObj = { id: "ss-new", name: "My Search", query: "react", mode: "fts" };
      mockCreateSavedSearch.mockResolvedValue(savedObj);

      const response = await savedPOST(
        jsonReq("/api/search/saved", {
          name: "My Search",
          query: "react",
          mode: "fts",
        })
      );

      const data = await response.json();
      expect(response.status).toBe(201);
      expect(data.saved).toEqual(savedObj);
      expect(mockCreateSavedSearch).toHaveBeenCalledWith("user-1", {
        name: "My Search",
        query: "react",
        mode: "fts",
        filters: undefined,
      });
    });

    it("should return 400 when name is missing", async () => {
      const response = await savedPOST(
        jsonReq("/api/search/saved", { query: "react" })
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("Name and query required");
    });

    it("should return 400 when query is missing", async () => {
      const response = await savedPOST(
        jsonReq("/api/search/saved", { name: "Test" })
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("Name and query required");
    });

    it("should return 400 when both name and query are missing", async () => {
      const response = await savedPOST(
        jsonReq("/api/search/saved", {})
      );

      expect(response.status).toBe(400);
    });

    it("should pass filters to createSavedSearch", async () => {
      const filters = { tags: ["react"], dateFrom: "2025-01-01" };
      mockCreateSavedSearch.mockResolvedValue({ id: "ss-new", name: "Filtered", query: "react", mode: "fts" });

      await savedPOST(
        jsonReq("/api/search/saved", {
          name: "Filtered",
          query: "react",
          filters,
        })
      );

      expect(mockCreateSavedSearch).toHaveBeenCalledWith("user-1", expect.objectContaining({
        filters,
      }));
    });

    it("should return 500 when createSavedSearch throws", async () => {
      mockCreateSavedSearch.mockRejectedValue(new Error("DB error"));

      const response = await savedPOST(
        jsonReq("/api/search/saved", { name: "Test", query: "react" })
      );

      expect(response.status).toBe(500);
      expect((await response.json()).error).toBe("Failed to save search");
    });
  });

  // ── DELETE /api/search/saved ────────────────────────────────────────────

  describe("DELETE /api/search/saved", () => {
    it("should return 401 when not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const response = await savedDELETE(req("/api/search/saved?id=ss-1", { method: "DELETE" }));

      expect(response.status).toBe(401);
    });

    it("should delete saved search and return result", async () => {
      mockDeleteSavedSearch.mockResolvedValue(true);

      const response = await savedDELETE(req("/api/search/saved?id=ss-1", { method: "DELETE" }));

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.deleted).toBe(true);
      expect(mockDeleteSavedSearch).toHaveBeenCalledWith("user-1", "ss-1");
    });

    it("should return 400 when id is missing", async () => {
      const response = await savedDELETE(req("/api/search/saved", { method: "DELETE" }));

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("Search ID required");
    });

    it("should return deleted=false when search not found", async () => {
      mockDeleteSavedSearch.mockResolvedValue(false);

      const response = await savedDELETE(req("/api/search/saved?id=nonexistent", { method: "DELETE" }));

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.deleted).toBe(false);
    });
  });

  // ── GET /api/search/export ──────────────────────────────────────────────

  describe("GET /api/search/export", () => {
    it("should return 401 when not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const response = await exportGET(req("/api/search/export?q=test"));

      expect(response.status).toBe(401);
    });

    it("should return 429 when rate-limited", async () => {
      mockCheckRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, retryAfterMs: 60000 });

      const response = await exportGET(req("/api/search/export?q=test"));

      expect(response.status).toBe(429);
    });

    it("should return 400 when query is too short", async () => {
      const response = await exportGET(req("/api/search/export?q=a"));

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("Query too short");
    });

    it("should return 400 for empty query", async () => {
      const response = await exportGET(req("/api/search/export?q="));

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("Query too short");
    });

    it("should return JSON results by default", async () => {
      mockSearch.mockReturnValue([
        { id: "proj-1", title: "React Project", type: "project", snippet: "React", description: null },
      ]);

      const response = await exportGET(req("/api/search/export?q=React"));

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.results).toHaveLength(1);
      expect(data.query).toBe("React");
      expect(data.total).toBe(1);
    });

    it("should return JSON results when format=json", async () => {
      mockSearch.mockReturnValue([
        { id: "proj-1", title: "Test", type: "project", snippet: "Test", description: null },
      ]);

      const response = await exportGET(req("/api/search/export?q=test&format=json"));

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.results).toBeDefined();
    });

    it("should return CSV when format=csv", async () => {
      mockSearch.mockReturnValue([
        { id: "proj-1", title: "React Project", type: "project", snippet: "<mark>React</mark> Project", description: null },
      ]);

      const response = await exportGET(req("/api/search/export?q=React&format=csv"));

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/csv");
      expect(response.headers.get("Content-Disposition")).toContain("search-results.csv");

      const body = await response.text();
      expect(body).toContain("Type,Title,Snippet,Score");
      expect(body).toContain("project");
      expect(body).toContain("React Project");
    });

    it("should strip HTML tags from CSV snippets", async () => {
      mockSearch.mockReturnValue([
        { id: "proj-1", title: "Test", type: "project", snippet: "<mark>Test</mark> Project", description: null },
      ]);

      const response = await exportGET(req("/api/search/export?q=test&format=csv"));

      const body = await response.text();
      // Should not contain <mark> tags
      expect(body).not.toContain("<mark>");
      expect(body).not.toContain("</mark>");
    });

    it("should use filteredSearch when filters are present", async () => {
      mockFilteredSearch.mockReturnValue([
        { id: "proj-1", title: "Test", type: "project", snippet: "Test", score: 0.9, description: null },
      ]);

      const response = await exportGET(
        req("/api/search/export?q=test&dateFrom=2025-01-01")
      );

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(mockFilteredSearch).toHaveBeenCalled();
      expect(mockSearch).not.toHaveBeenCalled();
    });

    it("should use basic search when no filters are present", async () => {
      mockSearch.mockReturnValue([]);

      const response = await exportGET(req("/api/search/export?q=test"));

      expect(mockSearch).toHaveBeenCalledWith("test", 100);
      expect(mockFilteredSearch).not.toHaveBeenCalled();
    });

    it("should use higher limit of 100 for export", async () => {
      mockSearch.mockReturnValue([]);

      await exportGET(req("/api/search/export?q=test"));

      expect(mockSearch).toHaveBeenCalledWith("test", 100);
    });

    it("should parse comma-separated tags filter", async () => {
      mockFilteredSearch.mockReturnValue([]);

      await exportGET(req("/api/search/export?q=test&tags=react,typescript"));

      expect(mockFilteredSearch).toHaveBeenCalledWith(
        "test",
        expect.objectContaining({
          tags: ["react", "typescript"],
        }),
        100
      );
    });

    it("should parse comma-separated entityTypes filter", async () => {
      mockFilteredSearch.mockReturnValue([]);

      await exportGET(req("/api/search/export?q=test&entityTypes=project,proposal"));

      expect(mockFilteredSearch).toHaveBeenCalledWith(
        "test",
        expect.objectContaining({
          entityTypes: ["project", "proposal"],
        }),
        100
      );
    });

    it("should ignore invalid entityTypes", async () => {
      mockFilteredSearch.mockReturnValue([]);

      await exportGET(req("/api/search/export?q=test&entityTypes=invalid,project"));

      expect(mockFilteredSearch).toHaveBeenCalledWith(
        "test",
        expect.objectContaining({
          entityTypes: ["project"],
        }),
        100
      );
    });

    it("should handle authorId filter", async () => {
      mockFilteredSearch.mockReturnValue([]);

      await exportGET(req("/api/search/export?q=test&authorId=user-1"));

      expect(mockFilteredSearch).toHaveBeenCalledWith(
        "test",
        expect.objectContaining({
          authorId: "user-1",
        }),
        100
      );
    });

    it("should handle projectId filter", async () => {
      mockFilteredSearch.mockReturnValue([]);

      await exportGET(req("/api/search/export?q=test&projectId=proj-1"));

      expect(mockFilteredSearch).toHaveBeenCalledWith(
        "test",
        expect.objectContaining({
          projectId: "proj-1",
        }),
        100
      );
    });

    it("should escape double quotes in CSV output", async () => {
      mockSearch.mockReturnValue([
        { id: "proj-1", title: 'He said "hello"', type: "project", snippet: "hello", description: null },
      ]);

      const response = await exportGET(req("/api/search/export?q=hello&format=csv"));

      const body = await response.text();
      // Double quotes should be escaped as ""
      expect(body).toContain('""hello""');
    });

    it("should add score to basic search results", async () => {
      mockSearch.mockReturnValue([
        { id: "proj-1", title: "First", type: "project", snippet: "First", description: null },
        { id: "proj-2", title: "Second", type: "project", snippet: "Second", description: null },
      ]);

      const response = await exportGET(req("/api/search/export?q=test&format=json"));

      const data = await response.json();
      // First result should have score close to 1
      expect(data.results[0].score).toBeDefined();
      expect(data.results[1].score).toBeDefined();
    });
  });
});
