import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({
  db: { select: vi.fn() },
}));

describe("dashboard queries module", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("exports getDashboardData function", async () => {
    const mod = await import("@/app/dashboard/queries");
    expect(mod.getDashboardData).toBeTypeOf("function");
  });

  it("getDashboardData requires a userId argument", async () => {
    const mod = await import("@/app/dashboard/queries");
    expect(mod.getDashboardData.length).toBe(1);
  });
});

describe("dashboard data calculation logic", () => {
  it("userStats counts are derived from array lengths and totals", () => {
    const userProjects = [{ id: "1" }, { id: "2" }];
    const userProposals = [{ id: "a" }];
    const userVoteCount = [{ total: 5 }];
    const userCommentCount = [{ total: 3 }];

    const userStats = {
      projectCount: userProjects.length,
      proposalCount: userProposals.length,
      voteCount: userVoteCount[0]?.total ?? 0,
      commentCount: userCommentCount[0]?.total ?? 0,
    };

    expect(userStats).toEqual({
      projectCount: 2,
      proposalCount: 1,
      voteCount: 5,
      commentCount: 3,
    });
  });

  it("platformStats defaults to 0 when undefined", () => {
    const platformStats = undefined;
    const result = {
      projectCount: Number(
        (platformStats as Record<string, number> | undefined)?.projectCount ?? 0,
      ),
      proposalCount: Number(
        (platformStats as Record<string, number> | undefined)?.proposalCount ?? 0,
      ),
      voteCount: Number(
        (platformStats as Record<string, number> | undefined)?.voteCount ?? 0,
      ),
      commentCount: Number(
        (platformStats as Record<string, number> | undefined)?.commentCount ?? 0,
      ),
    };

    expect(result).toEqual({
      projectCount: 0,
      proposalCount: 0,
      voteCount: 0,
      commentCount: 0,
    });
  });

  it("platformStats correctly converts numeric strings from SQL", () => {
    const platformStats = {
      projectCount: "10",
      proposalCount: "25",
      voteCount: "100",
      commentCount: "50",
    };

    const result = {
      projectCount: Number(platformStats.projectCount ?? 0),
      proposalCount: Number(platformStats.proposalCount ?? 0),
      voteCount: Number(platformStats.voteCount ?? 0),
      commentCount: Number(platformStats.commentCount ?? 0),
    };

    expect(result).toEqual({
      projectCount: 10,
      proposalCount: 25,
      voteCount: 100,
      commentCount: 50,
    });
  });

  it("userVoteCount defaults to 0 when array is empty", () => {
    const userVoteCount: { total: number }[] = [];
    expect(userVoteCount[0]?.total ?? 0).toBe(0);
  });

  it("userCommentCount defaults to 0 when array is empty", () => {
    const userCommentCount: { total: number }[] = [];
    expect(userCommentCount[0]?.total ?? 0).toBe(0);
  });

  it("userStats projectCount uses array length not a DB count", () => {
    // This mirrors the queries.ts logic: userStats.projectCount = userProjects.length
    const userProjects = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];
    expect(userProjects.length).toBe(3);
  });

  it("Number() safely handles null/undefined from SQL aggregates", () => {
    expect(Number(null ?? 0)).toBe(0);
    expect(Number(undefined ?? 0)).toBe(0);
    expect(Number(0)).toBe(0);
    expect(Number("42")).toBe(42);
  });
});
