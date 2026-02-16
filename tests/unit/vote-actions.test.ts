import { describe, it, expect, vi, beforeEach } from "vitest";

interface MockUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  role: "admin" | "manager" | "member" | "viewer";
  createdAt: Date | null;
  updatedAt: Date | null;
}

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const mockRequireAuth = vi.fn<() => Promise<MockUser>>();
vi.mock("@/lib/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/csrf", () => ({
  requireCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/ai", () => ({
  buildProposalSummary: vi.fn().mockResolvedValue("AI summary"),
}));

const mockEmitVoteChange = vi.fn();
vi.mock("@/lib/vote-events", () => ({
  emitVoteChange: (...args: unknown[]) => mockEmitVoteChange(...args),
}));

const mockInsertValues = vi.fn();
const mockOnConflictDoUpdate = vi.fn();
const mockDeleteWhere = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelectWhere = vi.fn();
const mockSelectLimit = vi.fn();

vi.mock("@/db", () => ({
  db: {
    insert: () => ({
      values: (...args: unknown[]) => {
        mockInsertValues(...args);
        const result = {
          onConflictDoUpdate: (...conflictArgs: unknown[]) => {
            mockOnConflictDoUpdate(...conflictArgs);
            return Promise.resolve();
          },
          then: (
            resolve: (v: undefined) => void,
            reject?: (e: unknown) => void
          ) => Promise.resolve(undefined).then(resolve, reject),
        };
        return result;
      },
    }),
    delete: () => ({
      where: (...args: unknown[]) => {
        mockDeleteWhere(...args);
        return Promise.resolve();
      },
    }),
    select: () => ({
      from: (...args: unknown[]) => {
        mockSelectFrom(...args);
        return {
          where: (...whereArgs: unknown[]) => {
            mockSelectWhere(...whereArgs);
            return { limit: () => mockSelectLimit() };
          },
        };
      },
    }),
  },
}));

function makeUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user-1",
    email: "alice@test.com",
    firstName: "Alice",
    lastName: "Test",
    avatarUrl: null,
    role: "member",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

import {
  deleteProposal,
  castVote,
  removeVote,
} from "@/app/projects/[id]/proposals/actions";

beforeEach(() => {
  mockRevalidatePath.mockClear();
  mockRequireAuth.mockReset();
  mockInsertValues.mockReset();
  mockOnConflictDoUpdate.mockClear();
  mockDeleteWhere.mockReset();
  mockSelectFrom.mockClear();
  mockSelectWhere.mockClear();
  mockSelectLimit.mockReset();
  mockEmitVoteChange.mockClear();
  mockRequireAuth.mockResolvedValue(makeUser());
  mockSelectLimit.mockReturnValue(Promise.resolve([]));
});

describe("deleteProposal", () => {
  it("rejects unauthenticated users", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
    const r = await deleteProposal("prop-1", "proj-1", "csrf");
    expect(r).toEqual({ error: "You must be logged in" });
    expect(mockDeleteWhere).not.toHaveBeenCalled();
  });

  it("rejects members (no delete permission)", async () => {
    const r = await deleteProposal("prop-1", "proj-1", "csrf");
    expect(r).toEqual({ error: "You don't have permission to delete proposals" });
  });

  it("returns not found when proposal missing", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ role: "manager" }));
    const r = await deleteProposal("x", "proj-1", "csrf");
    expect(r).toEqual({ error: "Proposal not found" });
  });

  it("rejects non-owner manager", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ id: "u1", role: "manager" }));
    mockSelectLimit.mockReturnValue(
      Promise.resolve([{ id: "prop-1", userId: "other" }])
    );
    const r = await deleteProposal("prop-1", "proj-1", "csrf");
    expect(r).toEqual({ error: "You don't have permission to delete this proposal" });
  });

  it("allows owner manager to delete", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ id: "u1", role: "manager" }));
    mockSelectLimit.mockReturnValue(
      Promise.resolve([{ id: "prop-1", userId: "u1" }])
    );
    const r = await deleteProposal("prop-1", "proj-1", "csrf");
    expect(r).toEqual({ success: true });
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it("allows admin to delete regardless of ownership", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ id: "a1", role: "admin" }));
    mockSelectLimit.mockReturnValue(
      Promise.resolve([{ id: "prop-1", userId: "other" }])
    );
    const r = await deleteProposal("prop-1", "proj-1", "csrf");
    expect(r).toEqual({ success: true });
  });

  it("returns generic error on non-auth failure", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ role: "admin" }));
    mockSelectLimit.mockRejectedValue(new Error("DB connection lost"));
    const r = await deleteProposal("prop-1", "proj-1", "csrf");
    expect(r).toEqual({ error: "Failed to delete proposal" });
  });
});

describe("castVote", () => {
  it("rejects unauthenticated users", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
    const r = await castVote("prop-1", 1, "proj-1", "csrf");
    expect(r).toEqual({ error: "You must be logged in to vote" });
  });

  it("rejects viewers", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ role: "viewer" }));
    const r = await castVote("prop-1", 1, "proj-1", "csrf");
    expect(r).toEqual({ error: "You don't have permission to vote" });
  });

  it("upserts a positive vote", async () => {
    const r = await castVote("prop-1", 1, "proj-1", "csrf");
    expect(r).toEqual({ success: true });
    expect(mockInsertValues).toHaveBeenCalledWith({
      proposalId: "prop-1",
      userId: "user-1",
      value: 1,
    });
    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ set: { value: 1 } })
    );
  });

  it("upserts a negative vote", async () => {
    const r = await castVote("prop-1", -1, "proj-1", "csrf");
    expect(r).toEqual({ success: true });
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ value: -1 })
    );
  });

  it("rejects invalid vote value (not 1 or -1)", async () => {
    const r = await castVote("prop-1", 0, "proj-1", "csrf");
    expect(r).toEqual({ error: "Invalid vote value — must be 1 or -1" });
  });

  it("rejects vote when project deadline has passed", async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    mockSelectLimit.mockReturnValue(Promise.resolve([{ deadline: pastDate }]));
    const r = await castVote("prop-1", 1, "proj-1", "csrf");
    expect(r).toEqual({ error: "Voting is closed — the project deadline has passed" });
  });

  it("returns error on DB failure", async () => {
    mockInsertValues.mockImplementation(() => {
      throw new Error("DB error");
    });
    const r = await castVote("prop-1", 1, "proj-1", "csrf");
    expect(r).toEqual({ error: "Failed to cast vote" });
  });
});

describe("removeVote", () => {
  it("rejects unauthenticated users", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
    const r = await removeVote("prop-1", "proj-1", "csrf");
    expect(r).toEqual({ error: "You must be logged in" });
  });

  it("rejects viewers", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ role: "viewer" }));
    const r = await removeVote("prop-1", "proj-1", "csrf");
    expect(r).toEqual({ error: "You don't have permission to vote" });
  });

  it("rejects vote removal when project deadline has passed", async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    mockSelectLimit.mockReturnValue(Promise.resolve([{ deadline: pastDate }]));
    const r = await removeVote("prop-1", "proj-1", "csrf");
    expect(r).toEqual({ error: "Voting is closed — the project deadline has passed" });
  });

  it("deletes the vote", async () => {
    const r = await removeVote("prop-1", "proj-1", "csrf");
    expect(r).toEqual({ success: true });
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it("returns error on DB failure", async () => {
    mockDeleteWhere.mockImplementation(() => {
      throw new Error("DB error");
    });
    const r = await removeVote("prop-1", "proj-1", "csrf");
    expect(r).toEqual({ error: "Failed to remove vote" });
  });
});
