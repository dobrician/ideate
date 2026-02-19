import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCacheDelete = vi.fn();

vi.mock("@/lib/cache", () => ({
  cacheDelete: (...args: unknown[]) => mockCacheDelete(...args),
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
    it("logs prefix invalidation request", () => {
      invalidateByPrefix("project:");
      // Currently a no-op placeholder that logs
    });
  });
});
