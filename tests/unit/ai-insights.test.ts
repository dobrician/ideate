/**
 * Unit tests for AI insights queries (src/app/admin/ai-insights/queries.ts).
 * Mocks database to test query logic in isolation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock("@/lib/ai/deadlines", () => ({
  getAllDeadlineHealth: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

vi.mock("@/lib/queue", () => ({
  registerHandler: vi.fn(),
  enqueue: vi.fn(),
}));

import { getAiInsightsData } from "@/app/admin/ai-insights/queries";
import { db } from "@/db";
import { getAllDeadlineHealth } from "@/lib/ai/deadlines";

const mockedDb = vi.mocked(db);
const mockedGetAllDeadlineHealth = vi.mocked(getAllDeadlineHealth);

describe("AI Insights Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return default stats when no data exists", async () => {
    // Mock all db.select calls to return zeros
    mockedDb.select.mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([{ total: 0, completed: 0, failed: 0 }]);
      chain.orderBy = vi.fn().mockReturnValue(chain);
      chain.then = (resolve: (v: unknown) => void) => resolve([{ total: 0, completed: 0, failed: 0, count: 0 }]);
      return chain as never;
    });

    mockedGetAllDeadlineHealth.mockResolvedValue([]);

    const data = await getAiInsightsData();

    expect(data.jobStats.routing.total).toBe(0);
    expect(data.jobStats.conflicts.total).toBe(0);
    expect(data.deadlineHealth.onTrack).toBe(0);
    expect(data.deadlineHealth.atRisk).toBe(0);
    expect(data.deadlineHealth.overdue).toBe(0);
    expect(data.embeddingCount).toBe(0);
  });

  it("should aggregate deadline health correctly", async () => {
    mockedDb.select.mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([{ total: 5, completed: 3, failed: 1 }]);
      chain.orderBy = vi.fn().mockReturnValue(chain);
      chain.then = (resolve: (v: unknown) => void) => resolve([{ total: 5, completed: 3, failed: 1, count: 10 }]);
      return chain as never;
    });

    mockedGetAllDeadlineHealth.mockResolvedValue([
      { projectId: "p1", health: "onTrack" as const, daysRemaining: 10, activityScore: 2, proposalCount: 5, voteCount: 20, completionEstimate: 60 },
      { projectId: "p2", health: "atRisk" as const, daysRemaining: 2, activityScore: 0.3, proposalCount: 1, voteCount: 2, completionEstimate: 80 },
      { projectId: "p3", health: "overdue" as const, daysRemaining: -3, activityScore: 0, proposalCount: 0, voteCount: 0, completionEstimate: 100 },
    ]);

    const data = await getAiInsightsData();

    expect(data.deadlineHealth.onTrack).toBe(1);
    expect(data.deadlineHealth.atRisk).toBe(1);
    expect(data.deadlineHealth.overdue).toBe(1);
  });

  it("should handle deadline health errors gracefully", async () => {
    mockedDb.select.mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([{ total: 0, completed: 0, failed: 0 }]);
      chain.orderBy = vi.fn().mockReturnValue(chain);
      chain.then = (resolve: (v: unknown) => void) => resolve([{ total: 0, completed: 0, failed: 0, count: 0 }]);
      return chain as never;
    });

    mockedGetAllDeadlineHealth.mockRejectedValue(new Error("DB error"));

    const data = await getAiInsightsData();

    // Should still return zeros, not crash
    expect(data.deadlineHealth.onTrack).toBe(0);
    expect(data.deadlineHealth.atRisk).toBe(0);
    expect(data.deadlineHealth.overdue).toBe(0);
  });

  it("should return recent jobs list", async () => {
    let callCount = 0;
    mockedDb.select.mockImplementation(() => {
      callCount++;
      const chain: Record<string, unknown> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([]);
      chain.orderBy = vi.fn().mockReturnValue(chain);

      // Last call is for recent jobs
      if (callCount === 7) {
        const recentJobs = [
          { id: "j1", type: "ai-routing", status: "completed", createdAt: new Date(), completedAt: new Date(), lastError: null },
        ];
        chain.then = (resolve: (v: unknown) => void) => resolve(recentJobs);
        chain.limit = vi.fn().mockResolvedValue(recentJobs);
      } else {
        chain.then = (resolve: (v: unknown) => void) => resolve([{ total: 0, completed: 0, failed: 0, count: 0 }]);
      }
      return chain as never;
    });

    mockedGetAllDeadlineHealth.mockResolvedValue([]);

    const data = await getAiInsightsData();
    expect(data.recentJobs).toBeDefined();
    expect(Array.isArray(data.recentJobs)).toBe(true);
  });
});
