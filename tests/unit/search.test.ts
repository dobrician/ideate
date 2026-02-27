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

// Mock @/db and related modules needed by barrel-exported sub-modules (analytics, suggestions, saved)
vi.mock("@/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/db/schema", () => ({}));
vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  },
}));

// ── Import SUT ─────────────────────────────────────────────────────────────

import { search, rebuildSearchIndex } from "@/lib/search";

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockAll.mockReturnValue([]);
  mockGet.mockReturnValue(undefined);
  mockPrepare.mockReturnValue({ all: mockAll, get: mockGet });
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Search Library", () => {
  describe("search", () => {
    it("should return empty array for empty query", () => {
      const results = search("");

      expect(results).toEqual([]);
      expect(mockPrepare).not.toHaveBeenCalled();
    });

    it("should return empty array for whitespace-only query", () => {
      const results = search("   ");

      expect(results).toEqual([]);
      expect(mockPrepare).not.toHaveBeenCalled();
    });

    it("should return empty array for query shorter than 2 characters", () => {
      const results = search("a");

      expect(results).toEqual([]);
      expect(mockPrepare).not.toHaveBeenCalled();
    });

    it("should perform FTS search when FTS tables exist", () => {
      const projectResults = [
        {
          id: "proj-1",
          title: "React Migration",
          description: "Migrate to React 18",
          snippet: "<mark>React</mark> Migration",
        },
      ];

      const proposalResults = [
        {
          id: "prop-1",
          title: "Use React Hooks",
          description: null,
          snippet: "Use <mark>React</mark> Hooks",
        },
      ];

      mockAll
        .mockReturnValueOnce(projectResults)
        .mockReturnValueOnce(proposalResults)
        .mockReturnValueOnce([]); // comments

      const results = search("React");

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        id: "proj-1",
        title: "React Migration",
        type: "project",
      });
      expect(results[1]).toMatchObject({
        id: "prop-1",
        title: "Use React Hooks",
        type: "proposal",
      });

      // projects + proposals + comments FTS = 3 prepare calls
      expect(mockPrepare).toHaveBeenCalledTimes(3);
      expect(mockClose).toHaveBeenCalled();
    });

    it("should include comment results from FTS search", () => {
      mockAll
        .mockReturnValueOnce([]) // projects
        .mockReturnValueOnce([]) // proposals
        .mockReturnValueOnce([
          {
            id: "comm-1",
            content: "This is a great idea about React",
            projectId: "proj-1",
            proposalId: null,
            snippet: "great idea about <mark>React</mark>",
          },
        ]); // comments

      const results = search("React");

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: "comm-1",
        type: "comment",
        projectId: "proj-1",
      });
    });

    it("should resolve projectId for proposal-level comments", () => {
      mockAll
        .mockReturnValueOnce([]) // projects
        .mockReturnValueOnce([]) // proposals
        .mockReturnValueOnce([
          {
            id: "comm-1",
            content: "Nice proposal",
            projectId: null,
            proposalId: "prop-1",
            snippet: "Nice <mark>proposal</mark>",
          },
        ]); // comments

      mockGet.mockReturnValueOnce({ project_id: "proj-99" });

      const results = search("proposal");

      expect(results).toHaveLength(1);
      expect(results[0].projectId).toBe("proj-99");
    });

    it("should respect custom limit parameter", () => {
      mockAll.mockReturnValue([]);

      search("test", 5);

      expect(mockAll).toHaveBeenCalledWith(expect.any(String), 5);
    });

    it("should use default limit of 20 when not specified", () => {
      mockAll.mockReturnValue([]);

      search("test");

      expect(mockAll).toHaveBeenCalledWith(expect.any(String), 20);
    });

    it("should combine and limit results from multiple sources", () => {
      const projectResults = Array.from({ length: 15 }, (_, i) => ({
        id: `proj-${i}`,
        title: `Project ${i}`,
        description: null,
        snippet: `Project ${i}`,
      }));

      const proposalResults = Array.from({ length: 10 }, (_, i) => ({
        id: `prop-${i}`,
        title: `Proposal ${i}`,
        description: null,
        snippet: `Proposal ${i}`,
      }));

      mockAll
        .mockReturnValueOnce(projectResults)
        .mockReturnValueOnce(proposalResults)
        .mockReturnValueOnce([]); // comments

      const results = search("test", 20);

      // Should return exactly 20 results
      expect(results).toHaveLength(20);
    });

    it("should fall back to LIKE search when FTS fails", () => {
      // First prepare call throws (FTS error), then fallback succeeds
      mockPrepare
        .mockImplementationOnce(() => {
          throw new Error("no such table: projects_fts");
        })
        .mockImplementation(() => ({ all: mockAll, get: mockGet }));

      mockAll
        .mockReturnValueOnce([
          {
            id: "proj-1",
            title: "Test Project",
            description: "A test",
          },
        ])
        .mockReturnValueOnce([
          {
            id: "prop-1",
            title: "Test Proposal",
            description: "A proposal",
          },
        ])
        .mockReturnValueOnce([]); // comment fallback

      const results = search("test");

      expect(results).toHaveLength(2);
      expect(results[0].type).toBe("project");
      expect(results[0].snippet).toBe("Test Project");
      expect(results[1].type).toBe("proposal");
      expect(results[1].snippet).toBe("Test Proposal");
    });

    it("should include comment fallback results via LIKE", () => {
      mockPrepare
        .mockImplementationOnce(() => {
          throw new Error("no such table: projects_fts");
        })
        .mockImplementation(() => ({ all: mockAll, get: mockGet }));

      mockAll
        .mockReturnValueOnce([]) // projects fallback
        .mockReturnValueOnce([]) // proposals fallback
        .mockReturnValueOnce([
          {
            id: "comm-1",
            content: "A comment about testing",
            project_id: "proj-1",
          },
        ]); // comments fallback

      const results = search("test");

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe("comment");
      expect(results[0].projectId).toBe("proj-1");
    });

    it("should truncate long comment content and handle null project_id in fallback", () => {
      const longContent = "B".repeat(100);
      mockPrepare
        .mockImplementationOnce(() => {
          throw new Error("no such table: projects_fts");
        })
        .mockImplementation(() => ({ all: mockAll, get: mockGet }));

      mockAll
        .mockReturnValueOnce([]) // projects fallback
        .mockReturnValueOnce([]) // proposals fallback
        .mockReturnValueOnce([
          {
            id: "comm-2",
            content: longContent,
            project_id: null,
          },
        ]); // comments fallback

      const results = search("BB");

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe("comment");
      expect(results[0].title.length).toBeLessThanOrEqual(83);
      expect(results[0].title).toContain("...");
      expect(results[0].projectId).toBeUndefined();
      expect(results[0].snippet).toBe(longContent.slice(0, 100));
    });

    it("should close database connection after successful search", () => {
      mockAll.mockReturnValue([]);

      search("test");

      expect(mockClose).toHaveBeenCalled();
    });

    it("should close database connection even after error", () => {
      // Make all prepare calls throw
      mockPrepare.mockImplementation(() => {
        throw new Error("Database error");
      });
      mockAll.mockReturnValue([]);

      // Should catch the error internally and return empty array
      const results = search("test");

      expect(results).toEqual([]);
      expect(mockClose).toHaveBeenCalled();
    });

    it("should set busy timeout pragma", () => {
      mockAll.mockReturnValue([]);

      search("test");

      expect(mockPragma).toHaveBeenCalledWith("busy_timeout = 3000");
    });

    it("should handle null descriptions", () => {
      mockAll
        .mockReturnValueOnce([
          {
            id: "proj-1",
            title: "No Description",
            description: null,
            snippet: "<mark>No</mark> Description",
          },
        ])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]); // comments

      const results = search("no");

      expect(results[0].description).toBeNull();
    });

    it("should truncate long comment content for title", () => {
      const longContent = "A".repeat(100);
      mockAll
        .mockReturnValueOnce([]) // projects
        .mockReturnValueOnce([]) // proposals
        .mockReturnValueOnce([
          {
            id: "comm-1",
            content: longContent,
            projectId: "proj-1",
            proposalId: null,
            snippet: "AAA...",
          },
        ]); // comments

      const results = search("AA");

      expect(results[0].title.length).toBeLessThanOrEqual(83); // 80 + "..."
      expect(results[0].title).toContain("...");
    });

    it("should gracefully handle missing comments_fts table", () => {
      // projects + proposals succeed, comments FTS throws
      let callCount = 0;
      mockPrepare.mockImplementation(() => {
        callCount++;
        if (callCount === 3) {
          throw new Error("no such table: comments_fts");
        }
        return { all: mockAll, get: mockGet };
      });

      mockAll
        .mockReturnValueOnce([
          {
            id: "proj-1",
            title: "Test",
            description: null,
            snippet: "<mark>Test</mark>",
          },
        ])
        .mockReturnValueOnce([]); // proposals

      const results = search("Test");

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe("project");
    });
  });

  describe("DATABASE_URL default", () => {
    it("falls back to data/ideate.db when DATABASE_URL is unset", async () => {
      const orig = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;
      vi.resetModules();
      vi.doMock("better-sqlite3", () => ({
        default: class {
          prepare = mockPrepare;
          exec = mockExec;
          pragma = mockPragma;
          close = mockClose;
        },
      }));
      try {
        mockAll.mockReturnValue([]);
        const mod = await import("@/lib/search");
        const results = mod.search("test");
        expect(results).toEqual([]);
      } finally {
        process.env.DATABASE_URL = orig;
      }
    });
  });

  describe("rebuildSearchIndex", () => {
    it("should rebuild both FTS indexes", () => {
      rebuildSearchIndex();

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO projects_fts(projects_fts) VALUES('rebuild')")
      );
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO proposals_fts(proposals_fts) VALUES('rebuild')")
      );
    });

    it("should set busy timeout pragma", () => {
      rebuildSearchIndex();

      expect(mockPragma).toHaveBeenCalledWith("busy_timeout = 5000");
    });

    it("should close database connection after rebuild", () => {
      rebuildSearchIndex();

      expect(mockClose).toHaveBeenCalled();
    });

    it("should close database connection even when rebuild fails", () => {
      mockExec.mockImplementationOnce(() => {
        throw new Error("Rebuild failed");
      });

      expect(() => rebuildSearchIndex()).toThrow();
      expect(mockClose).toHaveBeenCalled();
    });
  });
});
