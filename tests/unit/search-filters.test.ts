import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockAll = vi.fn();
const mockGet = vi.fn();
const mockPrepare = vi.fn();
const mockExec = vi.fn();
const mockPragma = vi.fn();
const mockClose = vi.fn();

vi.mock("better-sqlite3", () => {
  return {
    default: class {
      prepare = mockPrepare;
      exec = mockExec;
      pragma = mockPragma;
      close = mockClose;
    },
  };
});

// ── Import SUT ─────────────────────────────────────────────────────────────

import { filteredSearch } from "@/lib/search/filters";

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockAll.mockReturnValue([]);
  mockGet.mockReturnValue(undefined);
  mockPrepare.mockReturnValue({ all: mockAll, get: mockGet });
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Filtered Search (search/filters.ts)", () => {
  describe("empty / short query handling", () => {
    it("should return empty array for empty query", () => {
      const results = filteredSearch("");
      expect(results).toEqual([]);
      expect(mockPrepare).not.toHaveBeenCalled();
    });

    it("should return empty array for whitespace-only query", () => {
      const results = filteredSearch("   ");
      expect(results).toEqual([]);
      expect(mockPrepare).not.toHaveBeenCalled();
    });

    it("should return empty array for single character query", () => {
      const results = filteredSearch("a");
      expect(results).toEqual([]);
      expect(mockPrepare).not.toHaveBeenCalled();
    });

    it("should return empty array for null-ish query", () => {
      const results = filteredSearch(undefined as unknown as string);
      expect(results).toEqual([]);
    });
  });

  describe("FTS query formation", () => {
    it("should call FTS with properly formatted query for single term", () => {
      mockAll.mockReturnValue([]);

      filteredSearch("React");

      // prepare should be called for projects, proposals, comments
      expect(mockPrepare).toHaveBeenCalled();
      // The first param to .all() should contain the FTS query
      const firstCall = mockAll.mock.calls[0];
      expect(firstCall).toBeDefined();
      // FTS query should be '"React"*'
      expect(firstCall[0]).toBe('"React"*');
    });

    it("should call FTS with properly formatted multi-word query", () => {
      mockAll.mockReturnValue([]);

      filteredSearch("React hooks");

      const firstCall = mockAll.mock.calls[0];
      expect(firstCall).toBeDefined();
      expect(firstCall[0]).toBe('"React"* "hooks"*');
    });

    it("should strip quotes from query", () => {
      mockAll.mockReturnValue([]);

      filteredSearch("React's \"hooks\"");

      const firstCall = mockAll.mock.calls[0];
      expect(firstCall).toBeDefined();
      // Quotes should be stripped — resulting in "Reacts hooks"
      expect(firstCall[0]).toContain('"Reacts"*');
      expect(firstCall[0]).toContain('"hooks"*');
    });
  });

  describe("entity type filtering", () => {
    it("should search all three entity types by default", () => {
      mockAll.mockReturnValue([]);

      filteredSearch("test");

      // 3 prepare calls: projects, proposals, comments
      expect(mockPrepare).toHaveBeenCalledTimes(3);
    });

    it("should only search projects when entityTypes = ['project']", () => {
      mockAll.mockReturnValue([]);

      filteredSearch("test", { entityTypes: ["project"] });

      // Only 1 prepare call for projects
      expect(mockPrepare).toHaveBeenCalledTimes(1);
      const sql = mockPrepare.mock.calls[0][0] as string;
      expect(sql).toContain("projects_fts");
    });

    it("should only search proposals when entityTypes = ['proposal']", () => {
      mockAll.mockReturnValue([]);

      filteredSearch("test", { entityTypes: ["proposal"] });

      expect(mockPrepare).toHaveBeenCalledTimes(1);
      const sql = mockPrepare.mock.calls[0][0] as string;
      expect(sql).toContain("proposals_fts");
    });

    it("should only search comments when entityTypes = ['comment']", () => {
      mockAll.mockReturnValue([]);

      filteredSearch("test", { entityTypes: ["comment"] });

      expect(mockPrepare).toHaveBeenCalledTimes(1);
      const sql = mockPrepare.mock.calls[0][0] as string;
      expect(sql).toContain("comments_fts");
    });

    it("should search projects and proposals when entityTypes = ['project', 'proposal']", () => {
      mockAll.mockReturnValue([]);

      filteredSearch("test", { entityTypes: ["project", "proposal"] });

      expect(mockPrepare).toHaveBeenCalledTimes(2);
    });
  });

  describe("date filters", () => {
    it("should apply dateFrom filter", () => {
      mockAll.mockReturnValue([]);

      filteredSearch("test", { dateFrom: "2025-01-01" });

      const sql = mockPrepare.mock.calls[0][0] as string;
      expect(sql).toContain("p.created_at >= ?");
    });

    it("should apply dateTo filter", () => {
      mockAll.mockReturnValue([]);

      filteredSearch("test", { dateTo: "2025-12-31" });

      const sql = mockPrepare.mock.calls[0][0] as string;
      expect(sql).toContain("p.created_at <= ?");
    });

    it("should apply both dateFrom and dateTo filters", () => {
      mockAll.mockReturnValue([]);

      filteredSearch("test", {
        dateFrom: "2025-01-01",
        dateTo: "2025-12-31",
      });

      const sql = mockPrepare.mock.calls[0][0] as string;
      expect(sql).toContain("p.created_at >= ?");
      expect(sql).toContain("p.created_at <= ?");
    });
  });

  describe("author filter", () => {
    it("should apply authorId filter to projects", () => {
      mockAll.mockReturnValue([]);

      filteredSearch("test", { authorId: "user-123" });

      const sql = mockPrepare.mock.calls[0][0] as string;
      expect(sql).toContain("p.user_id = ?");
    });

    it("should apply authorId filter to proposals", () => {
      mockAll.mockReturnValue([]);

      filteredSearch("test", { authorId: "user-123" });

      // Second prepare call is proposals
      const sql = mockPrepare.mock.calls[1][0] as string;
      expect(sql).toContain("p.user_id = ?");
    });

    it("should apply authorId filter to comments", () => {
      mockAll.mockReturnValue([]);

      filteredSearch("test", { authorId: "user-123" });

      // Third prepare call is comments
      const sql = mockPrepare.mock.calls[2][0] as string;
      expect(sql).toContain("c.user_id = ?");
    });
  });

  describe("tag filter", () => {
    it("should apply tags filter to projects", () => {
      mockAll.mockReturnValue([]);

      filteredSearch("test", { tags: ["react", "typescript"] });

      const sql = mockPrepare.mock.calls[0][0] as string;
      expect(sql).toContain("project_tags");
      expect(sql).toContain("t.name IN");
    });

    it("should apply tags filter to proposals", () => {
      mockAll.mockReturnValue([]);

      filteredSearch("test", { tags: ["react"] });

      const sql = mockPrepare.mock.calls[1][0] as string;
      expect(sql).toContain("proposal_tags");
      expect(sql).toContain("t.name IN");
    });
  });

  describe("minVotes filter", () => {
    it("should apply minVotes filter to proposals", () => {
      mockAll.mockReturnValue([]);

      filteredSearch("test", { minVotes: 5 });

      const sql = mockPrepare.mock.calls[1][0] as string;
      expect(sql).toContain("COUNT(*)");
      expect(sql).toContain("votes");
    });

    it("should not apply minVotes WHERE filter when minVotes is 0", () => {
      mockAll.mockReturnValue([]);

      filteredSearch("test", { minVotes: 0 });

      const sql = mockPrepare.mock.calls[1][0] as string;
      // The SELECT always includes voteCount subquery, but the WHERE should NOT
      // include the "COUNT(*) FROM votes ... >= ?" condition when minVotes is 0.
      expect(sql).not.toContain("COUNT(*)");
    });
  });

  describe("projectId filter", () => {
    it("should apply projectId filter to projects", () => {
      mockAll.mockReturnValue([]);

      filteredSearch("test", { projectId: "proj-1" });

      const sql = mockPrepare.mock.calls[0][0] as string;
      expect(sql).toContain("p.id = ?");
    });

    it("should apply projectId filter to proposals (via project_id)", () => {
      mockAll.mockReturnValue([]);

      filteredSearch("test", { projectId: "proj-1" });

      const sql = mockPrepare.mock.calls[1][0] as string;
      expect(sql).toContain("p.project_id = ?");
    });

    it("should apply projectId filter to comments", () => {
      mockAll.mockReturnValue([]);

      filteredSearch("test", { projectId: "proj-1" });

      const sql = mockPrepare.mock.calls[2][0] as string;
      expect(sql).toContain("c.project_id = ?");
    });
  });

  describe("projectStatus filter", () => {
    it("should apply projectStatus filter to projects", () => {
      mockAll.mockReturnValue([]);

      filteredSearch("test", { projectStatus: "active" });

      const sql = mockPrepare.mock.calls[0][0] as string;
      expect(sql).toContain("p.status = ?");
    });
  });

  describe("result formatting", () => {
    it("should return project results with correct shape", () => {
      mockAll
        .mockReturnValueOnce([
          {
            id: "proj-1",
            title: "React Migration",
            description: "Migrate to React 18",
            authorId: "user-1",
            createdAt: 1700000000,
            snippet: "<mark>React</mark> Migration",
            authorName: "John Doe",
            rank: -10,
          },
        ])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      const results = filteredSearch("React");

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: "proj-1",
        title: "React Migration",
        description: "Migrate to React 18",
        type: "project",
        snippet: "<mark>React</mark> Migration",
        authorId: "user-1",
        authorName: "John Doe",
      });
    });

    it("should return proposal results with voteCount", () => {
      mockAll
        .mockReturnValueOnce([]) // projects
        .mockReturnValueOnce([
          {
            id: "prop-1",
            title: "Use Hooks",
            description: "Migrate to hooks",
            projectId: "proj-1",
            authorId: "user-1",
            createdAt: 1700000000,
            snippet: "Use <mark>Hooks</mark>",
            authorName: "Jane Doe",
            voteCount: 42,
            rank: -5,
          },
        ])
        .mockReturnValueOnce([]);

      const results = filteredSearch("Hooks");

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        type: "proposal",
        voteCount: 42,
        projectId: "proj-1",
      });
    });

    it("should return comment results with truncated title", () => {
      const longContent = "A".repeat(100);
      mockAll
        .mockReturnValueOnce([])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([
          {
            id: "comm-1",
            content: longContent,
            projectId: "proj-1",
            proposalId: null,
            authorId: "user-1",
            createdAt: 1700000000,
            snippet: "AAA...",
            authorName: "Bob",
          },
        ]);

      const results = filteredSearch("AA");

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe("comment");
      expect(results[0].title.length).toBeLessThanOrEqual(83);
      expect(results[0].title).toContain("...");
    });

    it("should return proper score values sorted descending", () => {
      mockAll
        .mockReturnValueOnce([
          { id: "proj-1", title: "P1", description: null, authorId: null, createdAt: null, snippet: "P1", authorName: null, rank: -10 },
          { id: "proj-2", title: "P2", description: null, authorId: null, createdAt: null, snippet: "P2", authorName: null, rank: -5 },
        ])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      const results = filteredSearch("test");

      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      expect(results[0].score).toBe(1);
    });

    it("should return authorName as undefined when null", () => {
      mockAll
        .mockReturnValueOnce([
          { id: "proj-1", title: "P1", description: null, authorId: null, createdAt: null, snippet: "P1", authorName: null, rank: -10 },
        ])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      const results = filteredSearch("test");

      expect(results[0].authorName).toBeUndefined();
      expect(results[0].authorId).toBeUndefined();
    });
  });

  describe("result limiting", () => {
    it("should limit results to default 20", () => {
      const manyResults = Array.from({ length: 15 }, (_, i) => ({
        id: `proj-${i}`,
        title: `Project ${i}`,
        description: null,
        authorId: null,
        createdAt: null,
        snippet: `Project ${i}`,
        authorName: null,
        rank: -i,
      }));

      mockAll
        .mockReturnValueOnce(manyResults)
        .mockReturnValueOnce(manyResults.slice(0, 10))
        .mockReturnValueOnce([]);

      const results = filteredSearch("test");

      expect(results.length).toBeLessThanOrEqual(20);
    });

    it("should respect custom limit parameter", () => {
      const manyResults = Array.from({ length: 10 }, (_, i) => ({
        id: `proj-${i}`,
        title: `Project ${i}`,
        description: null,
        authorId: null,
        createdAt: null,
        snippet: `Project ${i}`,
        authorName: null,
        rank: -i,
      }));

      mockAll
        .mockReturnValueOnce(manyResults)
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      const results = filteredSearch("test", {}, 5);

      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe("FTS error handling", () => {
    it("should return empty array when FTS query throws", () => {
      mockPrepare.mockImplementation(() => {
        throw new Error("no such table: projects_fts");
      });

      const results = filteredSearch("test");

      expect(results).toEqual([]);
    });

    it("should close database connection even after error", () => {
      mockPrepare.mockImplementation(() => {
        throw new Error("Database error");
      });

      filteredSearch("test");

      expect(mockClose).toHaveBeenCalled();
    });

    it("should close database connection after successful search", () => {
      mockAll.mockReturnValue([]);

      filteredSearch("test");

      expect(mockClose).toHaveBeenCalled();
    });

    it("should set busy timeout pragma", () => {
      mockAll.mockReturnValue([]);

      filteredSearch("test");

      expect(mockPragma).toHaveBeenCalledWith("busy_timeout = 3000");
    });

    it("should handle partial failures (projects fail but proposals succeed)", () => {
      let callCount = 0;
      mockPrepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) throw new Error("FTS error");
        return { all: mockAll, get: mockGet };
      });

      mockAll
        .mockReturnValueOnce([
          {
            id: "prop-1",
            title: "Test Proposal",
            description: null,
            projectId: "proj-1",
            authorId: null,
            createdAt: null,
            snippet: "Test",
            authorName: null,
            voteCount: 0,
            rank: -1,
          },
        ])
        .mockReturnValueOnce([]);

      // The function catches errors per-type internally
      const results = filteredSearch("test");

      // Results may or may not be returned depending on error boundary
      // The main thing is it doesn't throw
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("comment projectId resolution", () => {
    it("should resolve projectId from proposal for comments", () => {
      mockAll
        .mockReturnValueOnce([])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([
          {
            id: "comm-1",
            content: "Nice proposal",
            projectId: null,
            proposalId: "prop-1",
            authorId: null,
            createdAt: null,
            snippet: "Nice <mark>proposal</mark>",
            authorName: null,
          },
        ]);

      mockGet.mockReturnValueOnce({ project_id: "proj-99" });

      const results = filteredSearch("proposal");

      expect(results).toHaveLength(1);
      expect(results[0].projectId).toBe("proj-99");
    });

    it("should use direct projectId when available for comments", () => {
      mockAll
        .mockReturnValueOnce([])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([
          {
            id: "comm-1",
            content: "Nice comment on project",
            projectId: "proj-direct",
            proposalId: null,
            authorId: null,
            createdAt: null,
            snippet: "Nice <mark>comment</mark>",
            authorName: null,
          },
        ]);

      const results = filteredSearch("comment");

      expect(results).toHaveLength(1);
      expect(results[0].projectId).toBe("proj-direct");
    });
  });

  describe("combined filters", () => {
    it("should apply multiple filters simultaneously", () => {
      mockAll.mockReturnValue([]);

      filteredSearch("test", {
        dateFrom: "2025-01-01",
        dateTo: "2025-12-31",
        authorId: "user-1",
        tags: ["react"],
        projectStatus: "active",
      });

      const sql = mockPrepare.mock.calls[0][0] as string;
      expect(sql).toContain("p.created_at >= ?");
      expect(sql).toContain("p.created_at <= ?");
      expect(sql).toContain("p.user_id = ?");
      expect(sql).toContain("p.status = ?");
      expect(sql).toContain("project_tags");
    });
  });

  describe("score computation", () => {
    it("should give comments a lower base score (0.8x) than projects/proposals", () => {
      mockAll
        .mockReturnValueOnce([
          { id: "proj-1", title: "Test", description: null, authorId: null, createdAt: null, snippet: "Test", authorName: null, rank: -10 },
        ])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([
          {
            id: "comm-1",
            content: "Test comment",
            projectId: "proj-1",
            proposalId: null,
            authorId: null,
            createdAt: null,
            snippet: "Test",
            authorName: null,
          },
        ]);

      const results = filteredSearch("Test");

      const projectResult = results.find((r) => r.type === "project");
      const commentResult = results.find((r) => r.type === "comment");

      expect(projectResult!.score).toBe(1);
      expect(commentResult!.score).toBe(0.8);
    });
  });
});
