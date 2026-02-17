import { describe, it, expect, vi, beforeEach } from "vitest";

let resultQueue: unknown[] = [];

function chainable() {
  const result = resultQueue.shift() ?? [];
  const obj: Record<string, unknown> = {};
  const self = () => obj;
  for (const m of [
    "select", "from", "where", "leftJoin", "innerJoin",
    "orderBy", "limit", "groupBy", "as",
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
  projects: { id: "id", title: "title", userId: "userId" },
  proposals: { id: "id", title: "title", projectId: "projectId", userId: "userId" },
  votes: { proposalId: "proposalId", userId: "userId", value: "value", createdAt: "createdAt" },
  comments: { id: "id", createdAt: "createdAt", userId: "userId", proposalId: "proposalId", projectId: "projectId" },
  users: { id: "id", firstName: "firstName", email: "email" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...a: unknown[]) => a),
  desc: vi.fn((a: unknown) => a),
  asc: vi.fn((a: unknown) => a),
  sql: Object.assign(vi.fn(() => ({ as: vi.fn(() => "sql-tag"), toString: () => "sql-tag" })), { raw: vi.fn() }),
  count: vi.fn(() => "count"),
  or: vi.fn((...a: unknown[]) => a),
  inArray: vi.fn((...a: unknown[]) => a),
  gte: vi.fn((...a: unknown[]) => a),
}));

describe("getChartData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns empty arrays when no data", async () => {
    resultQueue = [[], [], []];
    const { getChartData } = await import("@/app/dashboard/queries");
    const result = await getChartData();
    expect(result.votesOverTime).toEqual([]);
    expect(result.topProposals).toEqual([]);
    expect(result.activityHeatmap).toEqual([]);
  });

  it("returns votes over time with numeric values", async () => {
    resultQueue = [
      [{ date: "2026-02-01", pro: "5", contra: "2" }],
      [],
      [],
    ];
    const { getChartData } = await import("@/app/dashboard/queries");
    const result = await getChartData();
    expect(result.votesOverTime).toEqual([
      { date: "2026-02-01", pro: 5, contra: 2 },
    ]);
  });

  it("returns top proposals with truncated titles", async () => {
    resultQueue = [
      [],
      [{ title: "A very long proposal title that exceeds twenty five characters", pro: "10", contra: "3" }],
      [],
    ];
    const { getChartData } = await import("@/app/dashboard/queries");
    const result = await getChartData();
    expect(result.topProposals[0].title).toHaveLength(28); // 25 + "..."
    expect(result.topProposals[0].pro).toBe(10);
    expect(result.topProposals[0].contra).toBe(3);
  });

  it("returns short titles untruncated", async () => {
    resultQueue = [
      [],
      [{ title: "Short", pro: "1", contra: "0" }],
      [],
    ];
    const { getChartData } = await import("@/app/dashboard/queries");
    const result = await getChartData();
    expect(result.topProposals[0].title).toBe("Short");
  });

  it("returns activity heatmap with numeric counts", async () => {
    resultQueue = [
      [],
      [],
      [{ date: "2026-02-10", count: "15" }],
    ];
    const { getChartData } = await import("@/app/dashboard/queries");
    const result = await getChartData();
    expect(result.activityHeatmap).toEqual([
      { date: "2026-02-10", count: 15 },
    ]);
  });
});
