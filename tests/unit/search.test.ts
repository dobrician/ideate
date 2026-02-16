import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockAll = vi.fn();
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

import { search, rebuildSearchIndex } from "@/lib/search";

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockAll.mockReturnValue([]);
  mockPrepare.mockReturnValue({ all: mockAll });
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
        .mockReturnValueOnce(proposalResults);

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

      expect(mockPrepare).toHaveBeenCalledTimes(2);
      expect(mockClose).toHaveBeenCalled();
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
        .mockReturnValueOnce(proposalResults);

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
        .mockImplementation(() => ({ all: mockAll }));

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
        ]);

      const results = search("test");

      expect(results).toHaveLength(2);
      expect(results[0].type).toBe("project");
      expect(results[0].snippet).toBe("Test Project");
      expect(results[1].type).toBe("proposal");
      expect(results[1].snippet).toBe("Test Proposal");
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
        .mockReturnValueOnce([]);

      const results = search("no");

      expect(results[0].description).toBeNull();
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
