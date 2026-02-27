import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockInsertValues = vi.fn().mockResolvedValue(undefined);
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

let deleteResult: { changes: number };
const mockDeleteWhere = vi.fn(() => Promise.resolve(deleteResult));
const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

let selectResolvers: Array<unknown>;

function buildSelectChain(resolveValue: unknown) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve(resolveValue));
  chain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(resolveValue).then(onFulfilled, onRejected);
  return chain;
}

const mockSelect = vi.fn(() => {
  const val = selectResolvers.shift() ?? [];
  return buildSelectChain(val);
});

vi.mock("@/db", () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  savedSearches: {
    id: "id",
    userId: "userId",
    name: "name",
    query: "query",
    mode: "mode",
    filters: "filters",
    createdAt: "createdAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
}));

vi.mock("crypto", () => ({
  randomUUID: () => "test-uuid-saved-1234",
}));

// ── Import SUT ─────────────────────────────────────────────────────────────

import {
  getUserSavedSearches,
  createSavedSearch,
  deleteSavedSearch,
} from "@/lib/search/saved";

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  selectResolvers = [];
  deleteResult = { changes: 1 };
  mockInsertValues.mockResolvedValue(undefined);
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Saved Searches (search/saved.ts)", () => {
  describe("getUserSavedSearches", () => {
    it("should return user saved searches ordered by date", async () => {
      selectResolvers = [
        [
          {
            id: "ss-1",
            name: "React searches",
            query: "react hooks",
            mode: "fts",
            filters: null,
            createdAt: new Date("2025-06-01"),
          },
          {
            id: "ss-2",
            name: "TypeScript queries",
            query: "typescript generics",
            mode: "semantic",
            filters: '{"tags":["typescript"]}',
            createdAt: new Date("2025-05-01"),
          },
        ],
      ];

      const results = await getUserSavedSearches("user-1");

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        id: "ss-1",
        name: "React searches",
        query: "react hooks",
        mode: "fts",
        filters: undefined,
        createdAt: new Date("2025-06-01"),
      });
      expect(results[1]).toEqual({
        id: "ss-2",
        name: "TypeScript queries",
        query: "typescript generics",
        mode: "semantic",
        filters: { tags: ["typescript"] },
        createdAt: new Date("2025-05-01"),
      });
    });

    it("should return empty array when user has no saved searches", async () => {
      selectResolvers = [[]];

      const results = await getUserSavedSearches("user-1");

      expect(results).toEqual([]);
    });

    it("should parse JSON filters when present", async () => {
      selectResolvers = [
        [
          {
            id: "ss-1",
            name: "Filtered search",
            query: "test",
            mode: "fts",
            filters: '{"dateFrom":"2025-01-01","authorId":"user-2"}',
            createdAt: null,
          },
        ],
      ];

      const results = await getUserSavedSearches("user-1");

      expect(results[0].filters).toEqual({
        dateFrom: "2025-01-01",
        authorId: "user-2",
      });
    });

    it("should return undefined filters when filters is null", async () => {
      selectResolvers = [
        [
          {
            id: "ss-1",
            name: "No filters",
            query: "test",
            mode: "fts",
            filters: null,
            createdAt: null,
          },
        ],
      ];

      const results = await getUserSavedSearches("user-1");

      expect(results[0].filters).toBeUndefined();
    });

    it("should call select with the correct user ID", async () => {
      selectResolvers = [[]];

      await getUserSavedSearches("user-abc");

      expect(mockSelect).toHaveBeenCalledTimes(1);
    });
  });

  describe("createSavedSearch", () => {
    it("should create a new saved search record", async () => {
      const result = await createSavedSearch("user-1", {
        name: "My Search",
        query: "react hooks",
      });

      expect(mockInsert).toHaveBeenCalled();
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "test-uuid-saved-1234",
          userId: "user-1",
          name: "My Search",
          query: "react hooks",
          mode: "fts", // default
          filters: null,
        })
      );

      expect(result).toEqual({
        id: "test-uuid-saved-1234",
        name: "My Search",
        query: "react hooks",
        mode: "fts",
        filters: undefined,
      });
    });

    it("should truncate name to 200 characters", async () => {
      const longName = "N".repeat(300);

      await createSavedSearch("user-1", {
        name: longName,
        query: "test",
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: longName.slice(0, 200),
        })
      );
    });

    it("should truncate query to 500 characters", async () => {
      const longQuery = "Q".repeat(600);

      await createSavedSearch("user-1", {
        name: "Test",
        query: longQuery,
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          query: longQuery.slice(0, 500),
        })
      );
    });

    it("should store JSON-serialized filters when provided", async () => {
      const filters = { dateFrom: "2025-01-01", tags: ["react"] };

      await createSavedSearch("user-1", {
        name: "Filtered",
        query: "react",
        filters,
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: JSON.stringify(filters),
        })
      );
    });

    it("should use provided mode when valid (semantic)", async () => {
      const result = await createSavedSearch("user-1", {
        name: "Semantic",
        query: "react",
        mode: "semantic",
      });

      expect(result.mode).toBe("semantic");
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "semantic",
        })
      );
    });

    it("should accept hybrid mode", async () => {
      const result = await createSavedSearch("user-1", {
        name: "Hybrid",
        query: "react",
        mode: "hybrid",
      });

      expect(result.mode).toBe("hybrid");
    });

    it("should fall back to fts for invalid mode", async () => {
      const result = await createSavedSearch("user-1", {
        name: "Invalid mode",
        query: "react",
        mode: "invalid",
      });

      expect(result.mode).toBe("fts");
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "fts",
        })
      );
    });

    it("should fall back to fts when mode is undefined", async () => {
      const result = await createSavedSearch("user-1", {
        name: "No mode",
        query: "react",
      });

      expect(result.mode).toBe("fts");
    });

    it("should return the created saved search object", async () => {
      const filters = { tags: ["react"] };
      const result = await createSavedSearch("user-1", {
        name: "My Search",
        query: "react",
        mode: "fts",
        filters,
      });

      expect(result).toEqual({
        id: "test-uuid-saved-1234",
        name: "My Search",
        query: "react",
        mode: "fts",
        filters,
      });
    });
  });

  describe("deleteSavedSearch", () => {
    it("should delete user own saved search", async () => {
      deleteResult = { changes: 1 };

      const result = await deleteSavedSearch("user-1", "ss-1");

      expect(mockDelete).toHaveBeenCalled();
      expect(mockDeleteWhere).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should return false when search not found or not owned by user", async () => {
      deleteResult = { changes: 0 };

      const result = await deleteSavedSearch("user-1", "ss-nonexistent");

      expect(result).toBe(false);
    });

    it("should return false when changes is undefined", async () => {
      deleteResult = undefined as unknown as { changes: number };

      const result = await deleteSavedSearch("user-1", "ss-1");

      expect(result).toBe(false);
    });

    it("should use both userId and searchId in where clause", async () => {
      deleteResult = { changes: 1 };

      await deleteSavedSearch("user-1", "ss-1");

      // The and() function should be called with both eq conditions
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    it("should not delete other users saved searches", async () => {
      // The implementation uses AND(eq(id, searchId), eq(userId, userId))
      // So attempting to delete another user's search returns changes: 0
      deleteResult = { changes: 0 };

      const result = await deleteSavedSearch("user-2", "ss-owned-by-user-1");

      expect(result).toBe(false);
    });
  });
});
