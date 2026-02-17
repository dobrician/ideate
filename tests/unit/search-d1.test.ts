import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchD1 } from "@/lib/search-d1";

function createMockD1(overrides?: Partial<Record<string, unknown>>): D1Database {
  const defaultResults = { results: [] };
  const mockStmt = {
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue(overrides?.all ?? defaultResults),
  };
  return {
    prepare: vi.fn(() => mockStmt),
    exec: vi.fn(),
    batch: vi.fn(),
    dump: vi.fn(),
  } as unknown as D1Database;
}

describe("searchD1", () => {
  it("returns empty array for empty query", async () => {
    const db = createMockD1();
    expect(await searchD1(db, "")).toEqual([]);
    expect(await searchD1(db, " ")).toEqual([]);
  });

  it("returns empty array for query shorter than 2 chars", async () => {
    const db = createMockD1();
    expect(await searchD1(db, "a")).toEqual([]);
  });

  it("searches with FTS5 and returns project results", async () => {
    const projectResults = {
      results: [
        { id: "p1", title: "Test Project", description: "desc", snippet: "<mark>Test</mark>" },
      ],
    };
    const emptyResults = { results: [] };

    const stmtIndex = { current: 0 };
    const responses = [projectResults, emptyResults, emptyResults];
    const mockStmt = {
      bind: vi.fn().mockReturnThis(),
      all: vi.fn(() => Promise.resolve(responses[stmtIndex.current++])),
    };
    const db = {
      prepare: vi.fn(() => mockStmt),
    } as unknown as D1Database;

    const results = await searchD1(db, "Test");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "p1",
      title: "Test Project",
      type: "project",
    });
  });

  it("falls back to LIKE when FTS fails", async () => {
    const projectResults = {
      results: [
        { id: "p1", title: "Fallback Project", description: null },
      ],
    };
    const emptyResults = { results: [] };
    let callCount = 0;

    const mockStmt = {
      bind: vi.fn().mockReturnThis(),
      all: vi.fn(() => {
        callCount++;
        // First 3 calls are FTS — make them fail
        if (callCount <= 3) return Promise.reject(new Error("no such table"));
        // Next 3 are fallback LIKE
        if (callCount === 4) return Promise.resolve(projectResults);
        return Promise.resolve(emptyResults);
      }),
    };
    const db = {
      prepare: vi.fn(() => mockStmt),
    } as unknown as D1Database;

    const results = await searchD1(db, "Fallback");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "p1",
      type: "project",
      snippet: "Fallback Project",
    });
  });

  it("returns empty when both FTS and fallback fail", async () => {
    const mockStmt = {
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockRejectedValue(new Error("DB error")),
    };
    const db = {
      prepare: vi.fn(() => mockStmt),
    } as unknown as D1Database;

    const results = await searchD1(db, "anything");
    expect(results).toEqual([]);
  });

  it("respects limit parameter", async () => {
    const manyResults = {
      results: Array.from({ length: 30 }, (_, i) => ({
        id: `p${i}`,
        title: `Project ${i}`,
        description: null,
        snippet: `Project ${i}`,
      })),
    };
    const emptyResults = { results: [] };
    let callCount = 0;

    const mockStmt = {
      bind: vi.fn().mockReturnThis(),
      all: vi.fn(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve(manyResults);
        return Promise.resolve(emptyResults);
      }),
    };
    const db = {
      prepare: vi.fn(() => mockStmt),
    } as unknown as D1Database;

    const results = await searchD1(db, "Project", 5);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it("includes proposal results from FTS with projectId", async () => {
    const proposalResults = {
      results: [
        { id: "prop1", title: "My Proposal", description: "desc", projectId: "p1", snippet: "<mark>Proposal</mark>" },
      ],
    };
    const emptyResults = { results: [] };
    let callCount = 0;

    const mockStmt = {
      bind: vi.fn().mockReturnThis(),
      all: vi.fn(() => {
        callCount++;
        if (callCount === 2) return Promise.resolve(proposalResults);
        return Promise.resolve(emptyResults);
      }),
    };
    const db = { prepare: vi.fn(() => mockStmt) } as unknown as D1Database;

    const results = await searchD1(db, "Proposal");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "prop1",
      type: "proposal",
      projectId: "p1",
    });
  });

  it("fallback returns proposals and comments with correct mapping", async () => {
    const proposalResults = {
      results: [
        { id: "prop1", title: "Fallback Prop", description: "desc", projectId: "proj1" },
      ],
    };
    const commentResults = {
      results: [
        { id: "c1", content: "Short", project_id: "proj2" },
        { id: "c2", content: "A".repeat(100), project_id: null },
      ],
    };
    const emptyResults = { results: [] };
    let callCount = 0;

    const mockStmt = {
      bind: vi.fn().mockReturnThis(),
      all: vi.fn(() => {
        callCount++;
        // First 3 calls are FTS — fail
        if (callCount <= 3) return Promise.reject(new Error("no FTS"));
        // Fallback: call 4=projects(empty), 5=proposals, 6=comments
        if (callCount === 4) return Promise.resolve(emptyResults);
        if (callCount === 5) return Promise.resolve(proposalResults);
        if (callCount === 6) return Promise.resolve(commentResults);
        return Promise.resolve(emptyResults);
      }),
    };
    const db = { prepare: vi.fn(() => mockStmt) } as unknown as D1Database;

    const results = await searchD1(db, "test query");
    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({ id: "prop1", type: "proposal", snippet: "Fallback Prop", projectId: "proj1" });
    expect(results[1]).toMatchObject({ id: "c1", type: "comment", title: "Short", projectId: "proj2" });
    expect(results[2]).toMatchObject({ id: "c2", type: "comment", projectId: undefined });
    expect(results[2].title).toContain("...");
  });

  it("includes comment results with truncated and short titles", async () => {
    const longContent = "A".repeat(100);
    const shortContent = "Short comment";
    const commentResults = {
      results: [
        { id: "c1", content: longContent, projectId: "p1", snippet: "<mark>A</mark>" },
        { id: "c2", content: shortContent, projectId: null, snippet: "<mark>Short</mark>" },
      ],
    };
    const emptyResults = { results: [] };
    let callCount = 0;

    const mockStmt = {
      bind: vi.fn().mockReturnThis(),
      all: vi.fn(() => {
        callCount++;
        if (callCount === 3) return Promise.resolve(commentResults);
        return Promise.resolve(emptyResults);
      }),
    };
    const db = {
      prepare: vi.fn(() => mockStmt),
    } as unknown as D1Database;

    const results = await searchD1(db, "AAAA");
    expect(results).toHaveLength(2);
    expect(results[0].type).toBe("comment");
    expect(results[0].title.length).toBeLessThanOrEqual(83); // 80 + "..."
    expect(results[0].projectId).toBe("p1");
    expect(results[1].title).toBe("Short comment");
    expect(results[1].projectId).toBeUndefined();
  });
});
