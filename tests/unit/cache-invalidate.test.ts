import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCacheDelete = vi.fn();
const mockGetMemoryKeys = vi.fn<() => string[]>(() => []);
const mockInvalidateTag = vi.fn(() => 0);

vi.mock("@/lib/cache", () => ({
  cacheDelete: (...args: unknown[]) => mockCacheDelete(...args),
  getMemoryKeys: () => mockGetMemoryKeys(),
}));

vi.mock("@/lib/cache/tags", () => ({
  invalidateTag: (...args: unknown[]) => mockInvalidateTag(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  invalidateProject,
  invalidateProposal,
  invalidateVote,
  invalidateByPrefix,
} from "@/lib/cache/invalidate";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Cache invalidation", () => {
  describe("invalidateProject", () => {
    it("deletes project-related cache keys", () => {
      invalidateProject("proj-1");
      expect(mockCacheDelete).toHaveBeenCalledWith("project:proj-1");
      expect(mockCacheDelete).toHaveBeenCalledWith("project:proj-1:proposals");
      expect(mockCacheDelete).toHaveBeenCalledWith("project:proj-1:votes");
      expect(mockCacheDelete).toHaveBeenCalledWith("dashboard:projects");
      expect(mockCacheDelete).toHaveBeenCalledTimes(4);
    });

    it("invalidates project tag", () => {
      invalidateProject("proj-1");
      expect(mockInvalidateTag).toHaveBeenCalledWith("project:proj-1");
    });
  });

  describe("invalidateProposal", () => {
    it("deletes proposal and project cache keys", () => {
      invalidateProposal("prop-1", "proj-1");
      expect(mockCacheDelete).toHaveBeenCalledWith("proposal:prop-1");
      expect(mockCacheDelete).toHaveBeenCalledWith("project:proj-1:proposals");
      expect(mockCacheDelete).toHaveBeenCalledWith("project:proj-1:votes");
      expect(mockCacheDelete).toHaveBeenCalledWith("dashboard:projects");
      expect(mockCacheDelete).toHaveBeenCalledTimes(4);
    });

    it("invalidates proposal tag", () => {
      invalidateProposal("prop-1", "proj-1");
      expect(mockInvalidateTag).toHaveBeenCalledWith("proposal:prop-1");
    });
  });

  describe("invalidateVote", () => {
    it("deletes vote-related cache keys", () => {
      invalidateVote("prop-1", "proj-1");
      expect(mockCacheDelete).toHaveBeenCalledWith("proposal:prop-1");
      expect(mockCacheDelete).toHaveBeenCalledWith("proposal:prop-1:votes");
      expect(mockCacheDelete).toHaveBeenCalledWith("project:proj-1:votes");
      expect(mockCacheDelete).toHaveBeenCalledTimes(3);
    });
  });

  describe("invalidateByPrefix", () => {
    it("deletes all keys matching prefix", () => {
      mockGetMemoryKeys.mockReturnValue([
        "project:1",
        "project:2",
        "project:1:proposals",
        "proposal:1",
        "dashboard:projects",
      ]);

      const count = invalidateByPrefix("project:");
      expect(count).toBe(3);
      expect(mockCacheDelete).toHaveBeenCalledWith("project:1");
      expect(mockCacheDelete).toHaveBeenCalledWith("project:2");
      expect(mockCacheDelete).toHaveBeenCalledWith("project:1:proposals");
      expect(mockCacheDelete).not.toHaveBeenCalledWith("proposal:1");
    });

    it("returns 0 when no keys match", () => {
      mockGetMemoryKeys.mockReturnValue(["proposal:1", "vote:1"]);
      expect(invalidateByPrefix("project:")).toBe(0);
    });

    it("returns 0 when cache is empty", () => {
      mockGetMemoryKeys.mockReturnValue([]);
      expect(invalidateByPrefix("project:")).toBe(0);
    });
  });
});
