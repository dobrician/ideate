import { describe, it, expect, vi, beforeEach } from "vitest";

/* ---------- Queue-based chainable mock for Drizzle select chains ---------- */

let resultQueue: unknown[] = [];

function chainable() {
  const result = resultQueue.shift() ?? [];
  const obj: Record<string, unknown> = {};
  const self = () => obj;
  for (const m of [
    "select", "from", "where", "leftJoin", "innerJoin",
    "orderBy", "limit", "groupBy",
  ]) {
    obj[m] = vi.fn(self);
  }
  obj.then = (resolve: (v: unknown) => void) => resolve(result);
  return obj;
}

vi.mock("@/db", () => ({
  db: { select: vi.fn(() => chainable()) },
}));

vi.mock("@/db/schema", () => ({
  projects: { id: "id", title: "title", description: "desc", status: "status", deadline: "deadline", createdAt: "createdAt", updatedAt: "updatedAt", userId: "userId" },
  proposals: { id: "id", title: "title", projectId: "projectId", createdAt: "createdAt", userId: "userId" },
  votes: { proposalId: "proposalId", userId: "userId", value: "value", createdAt: "createdAt" },
  comments: { id: "id", content: "content", createdAt: "createdAt", userId: "userId", proposalId: "proposalId", projectId: "projectId" },
  users: { id: "id", firstName: "firstName", email: "email" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...a: unknown[]) => a),
  desc: vi.fn((a: unknown) => a),
  asc: vi.fn((a: unknown) => a),
  sql: Object.assign(vi.fn(() => "sql-tag"), { raw: vi.fn() }),
  count: vi.fn(() => "count"),
  or: vi.fn((...a: unknown[]) => a),
  inArray: vi.fn((...a: unknown[]) => a),
}));

const makeProjects = (n = 2) =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`, title: `P${i}`, description: "D", status: "active",
    deadline: new Date(), createdAt: new Date(), updatedAt: new Date(),
    userId: "u1", proposalCount: i, voteCount: i * 2, commentCount: i,
  }));

const makeActivity = (id = "c1") => [
  { id, content: "Nice", createdAt: new Date(), userName: "Alice", userEmail: "a@e.com", proposalTitle: "Prop", projectId: "p1" },
];

/**
 * getDashboardData runs Promise.all with 7 items.
 * Items 1-5 each do 1 select. Item 6 (getRecentActivity) does 1-2 selects.
 * Item 7 does 1 select. Total: 8-9 selects.
 *
 * Queue order depends on Promise.all resolution. Since our chainable resolves
 * synchronously (via .then), the order matches the array order in the source:
 *   [0] userProjects  [1] userProposals  [2] voteCount  [3] commentCount
 *   [4] recentVotes   [5] scoped-activity-subquery-1 (ownProjectIds)
 *   [6] scoped-activity-subquery-2 (ownProposalIds)
 *   [7] scoped-activity-main   [8?] global-fallback   [9] totalStats
 *
 * Actually getRecentActivity builds subqueries (db.select for ownProjectIds
 * and ownProposalIds) which are passed to inArray — they are NOT awaited,
 * they're used as subquery expressions. Then one main select is made.
 * If scoped returns empty, a second select is made (global fallback).
 * So: 5 (main) + 2 (subquery builders) + 1 (scoped) + 0-1 (fallback) + 1 (stats) = 9-10
 */

/** Build the queue for a standard scenario (scoped activity returns data). */
function standardQueue(overrides: Partial<{
  projects: unknown[];
  proposals: unknown[];
  voteCount: unknown[];
  commentCount: unknown[];
  recentVotes: unknown[];
  scopedActivity: unknown[];
  totalStats: unknown[];
}> = {}) {
  // getRecentActivity hits await on scoped query → yields → totalStats runs next
  return [
    overrides.projects ?? makeProjects(),
    overrides.proposals ?? [{ id: "pr1", title: "Prop", projectId: "p1", projectTitle: "P1", createdAt: new Date() }],
    overrides.voteCount ?? [{ total: 5 }],
    overrides.commentCount ?? [{ total: 3 }],
    overrides.recentVotes ?? [{ proposalId: "pr1", value: 1, proposalTitle: "Prop", projectId: "p1", createdAt: new Date() }],
    [], // subquery: ownProjectIds
    [], // subquery: ownProposalIds
    overrides.scopedActivity ?? makeActivity(), // scoped activity (before yield resumes)
    overrides.totalStats ?? [{ projectCount: 10, proposalCount: 25, voteCount: 100, commentCount: 50 }],
  ];
}

/** Queue with empty scoped → global fallback. */
function fallbackQueue(globalActivity: unknown[]) {
  // When scoped returns empty, getRecentActivity awaits (yields), so totalStats
  // select runs before the global fallback select resumes.
  return [
    [], [], [{ total: 0 }], [{ total: 0 }], [],
    [], [], // subquery builders
    [],     // scoped returns empty
    [{ projectCount: 0, proposalCount: 0, voteCount: 0, commentCount: 0 }], // totalStats (runs while getRecentActivity is yielded)
    globalActivity, // global fallback (resumes after yield)
  ];
}

describe("getDashboardData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns all dashboard fields with populated data", async () => {
    resultQueue = standardQueue();
    const { getDashboardData } = await import("@/app/dashboard/queries");
    const result = await getDashboardData("u1");

    expect(result.userProjects).toHaveLength(2);
    expect(result.userProposals).toHaveLength(1);
    expect(result.userVoteCount).toBe(5);
    expect(result.userCommentCount).toBe(3);
    expect(result.recentVotes).toHaveLength(1);
    expect(result.recentActivity).toHaveLength(1);
    expect(result.userStats).toEqual({ projectCount: 2, proposalCount: 1, voteCount: 5, commentCount: 3 });
    expect(result.platformStats).toEqual({ projectCount: 10, proposalCount: 25, voteCount: 100, commentCount: 50 });
  });

  it("defaults vote/comment counts to 0 when arrays are empty", async () => {
    resultQueue = standardQueue({ voteCount: [], commentCount: [] });
    const { getDashboardData } = await import("@/app/dashboard/queries");
    const result = await getDashboardData("u-empty");
    expect(result.userVoteCount).toBe(0);
    expect(result.userCommentCount).toBe(0);
    expect(result.userStats.voteCount).toBe(0);
    expect(result.userStats.commentCount).toBe(0);
  });

  it("converts string platformStats from SQL to numbers", async () => {
    resultQueue = standardQueue({
      totalStats: [{ projectCount: "7", proposalCount: "14", voteCount: "42", commentCount: "21" }],
    });
    const { getDashboardData } = await import("@/app/dashboard/queries");
    const result = await getDashboardData("u-str");
    expect(result.platformStats).toEqual({ projectCount: 7, proposalCount: 14, voteCount: 42, commentCount: 21 });
  });

  it("defaults platformStats to 0 when row is undefined", async () => {
    resultQueue = standardQueue({ totalStats: [] });
    const { getDashboardData } = await import("@/app/dashboard/queries");
    const result = await getDashboardData("u-undef");
    expect(result.platformStats).toEqual({ projectCount: 0, proposalCount: 0, voteCount: 0, commentCount: 0 });
  });

  it("userStats uses array lengths for project/proposal counts", async () => {
    resultQueue = standardQueue({ projects: makeProjects(3), proposals: [] });
    const { getDashboardData } = await import("@/app/dashboard/queries");
    const result = await getDashboardData("u-counts");
    expect(result.userStats.projectCount).toBe(3);
    expect(result.userStats.proposalCount).toBe(0);
  });
});

describe("getRecentActivity (via getDashboardData)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns scoped activity when user has project comments", async () => {
    resultQueue = standardQueue({ scopedActivity: makeActivity("scoped-1") });
    const { getDashboardData } = await import("@/app/dashboard/queries");
    const result = await getDashboardData("u-scoped");
    expect(result.recentActivity).toHaveLength(1);
    expect(result.recentActivity[0].id).toBe("scoped-1");
  });

  it("falls back to global activity when scoped returns empty", async () => {
    const global = makeActivity("global-1");
    resultQueue = fallbackQueue(global);
    const { getDashboardData } = await import("@/app/dashboard/queries");
    const result = await getDashboardData("u-new");
    expect(result.recentActivity).toHaveLength(1);
    expect(result.recentActivity[0].id).toBe("global-1");
  });
});
