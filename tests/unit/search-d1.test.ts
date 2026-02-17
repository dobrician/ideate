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

  it("includes comment results with truncated titles", async () => {
    const longContent = "A".repeat(100);
    const commentResults = {
      results: [
        { id: "c1", content: longContent, projectId: "p1", snippet: "<mark>A</mark>" },
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
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("comment");
    expect(results[0].title.length).toBeLessThanOrEqual(83); // 80 + "..."
    expect(results[0].projectId).toBe("p1");
  });
});
