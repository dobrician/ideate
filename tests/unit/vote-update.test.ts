import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEmitVoteChange = vi.fn();
vi.mock("@/lib/vote-events", () => ({
  emitVoteChange: (...args: unknown[]) => mockEmitVoteChange(...args),
}));

const mockSelectResults: unknown[][] = [];
let selectCallIndex = 0;

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => {
          const result = mockSelectResults[selectCallIndex] ?? [];
          selectCallIndex++;
          return Promise.resolve(result);
        },
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  votes: {
    proposalId: "proposalId",
    value: "value",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  sql: vi.fn(),
}));

describe("vote-update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectResults.length = 0;
    selectCallIndex = 0;
  });

  it("queries vote counts and emits via SSE", async () => {
    mockSelectResults.push([{ upvotes: 5, downvotes: 2 }]);

    const { emitVoteUpdate } = await import("@/lib/vote-update");
    await emitVoteUpdate("proposal-1", "project-1");

    expect(mockEmitVoteChange).toHaveBeenCalledWith({
      proposalId: "proposal-1",
      projectId: "project-1",
      upvotes: 5,
      downvotes: 2,
    });
  });

  it("defaults to 0 when query returns empty result", async () => {
    mockSelectResults.push([{}]);

    const { emitVoteUpdate } = await import("@/lib/vote-update");
    await emitVoteUpdate("proposal-2", "project-2");

    expect(mockEmitVoteChange).toHaveBeenCalledWith({
      proposalId: "proposal-2",
      projectId: "project-2",
      upvotes: 0,
      downvotes: 0,
    });
  });

  it("defaults to 0 when query returns no rows", async () => {
    mockSelectResults.push([]);

    const { emitVoteUpdate } = await import("@/lib/vote-update");
    await emitVoteUpdate("proposal-3", "project-3");

    expect(mockEmitVoteChange).toHaveBeenCalledWith({
      proposalId: "proposal-3",
      projectId: "project-3",
      upvotes: 0,
      downvotes: 0,
    });
  });

  it("converts string vote counts to numbers", async () => {
    mockSelectResults.push([{ upvotes: "10", downvotes: "3" }]);

    const { emitVoteUpdate } = await import("@/lib/vote-update");
    await emitVoteUpdate("proposal-4", "project-4");

    expect(mockEmitVoteChange).toHaveBeenCalledWith({
      proposalId: "proposal-4",
      projectId: "project-4",
      upvotes: 10,
      downvotes: 3,
    });
  });
});
