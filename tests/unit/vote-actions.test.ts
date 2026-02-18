import { describe, it, expect, vi, beforeEach } from "vitest";

interface MockUser { id: string; email: string; firstName: string | null; lastName: string | null; avatarUrl: string | null; role: "admin" | "manager" | "member" | "viewer"; createdAt: Date | null; updatedAt: Date | null; }

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

const mockEmitVoteUpdate = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/vote-update", () => ({
  emitVoteUpdate: (...args: unknown[]) => mockEmitVoteUpdate(...args),
}));

const mockInsertValues = vi.fn();
const mockOnConflictDoUpdate = vi.fn();
const mockDeleteWhere = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelectWhere = vi.fn();
const mockSelectResults: Array<Promise<unknown[]>> = [];
let selectCallIndex = 0;

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
            return {
              limit: () => {
                const idx = selectCallIndex++;
                return mockSelectResults[idx] ?? Promise.resolve([]);
              },
            };
          },
        };
      },
    }),
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 10, retryAfterMs: 0 }) }));
vi.mock("@/lib/request-utils", () => ({ getActionClientIp: vi.fn().mockResolvedValue("127.0.0.1") }));

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

function setSelectResults(...results: unknown[][]) {
  mockSelectResults.length = 0;
  results.forEach((r) => mockSelectResults.push(Promise.resolve(r)));
}

beforeEach(() => {
  mockRevalidatePath.mockClear();
  mockRequireAuth.mockReset();
  mockInsertValues.mockReset();
  mockOnConflictDoUpdate.mockClear();
  mockDeleteWhere.mockReset();
  mockSelectFrom.mockClear();
  mockSelectWhere.mockClear();
  mockEmitVoteUpdate.mockClear();
  selectCallIndex = 0;
  mockSelectResults.length = 0;
  mockRequireAuth.mockResolvedValue(makeUser());
  setSelectResults([]);
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
    setSelectResults([]);
    const r = await deleteProposal("x", "proj-1", "csrf");
    expect(r).toEqual({ error: "Proposal not found" });
  });

  it("rejects non-owner manager", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ id: "u1", role: "manager" }));
    setSelectResults([{ id: "prop-1", userId: "other" }]);
    const r = await deleteProposal("prop-1", "proj-1", "csrf");
    expect(r).toEqual({ error: "You don't have permission to delete this proposal" });
  });

  it("allows owner manager to delete", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ id: "u1", role: "manager" }));
    setSelectResults([{ id: "prop-1", userId: "u1" }]);
    const r = await deleteProposal("prop-1", "proj-1", "csrf");
    expect(r).toEqual({ success: true });
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it("allows admin to delete regardless of ownership", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ id: "a1", role: "admin" }));
    setSelectResults([{ id: "prop-1", userId: "other" }]);
    const r = await deleteProposal("prop-1", "proj-1", "csrf");
    expect(r).toEqual({ success: true });
  });

  it("returns generic error on non-auth failure", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ role: "admin" }));
    mockSelectResults.length = 0;
    const rejection = Promise.reject(new Error("DB connection lost"));
    rejection.catch(() => {}); // prevent unhandled rejection
    mockSelectResults.push(rejection);
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
    setSelectResults([{ projectId: "proj-1" }], [{ status: "active" }], []);
    const r = await castVote("prop-1", 1, "proj-1", "csrf");
    expect(r).toEqual({ success: true });
    expect(mockInsertValues).toHaveBeenCalledWith({
      proposalId: "prop-1",
      userId: "user-1",
      value: 1,
    });
    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ set: expect.objectContaining({ value: 1, updatedAt: expect.any(Date) }) })
    );
  });

  it("upserts a negative vote", async () => {
    setSelectResults([{ projectId: "proj-1" }], [{ status: "active" }], []);
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
    setSelectResults([{ projectId: "proj-1" }], [{ status: "active" }], [{ deadline: pastDate }]);
    const r = await castVote("prop-1", 1, "proj-1", "csrf");
    expect(r).toEqual({ error: "Voting is closed — the project deadline has passed" });
  });

  it("rejects vote when project is archived", async () => {
    setSelectResults([{ projectId: "proj-1" }], [{ status: "archived" }]);
    const r = await castVote("prop-1", 1, "proj-1", "csrf");
    expect(r).toEqual({ error: "This project is archived and read-only" });
  });

  it("uses server-resolved projectId for deadline check, ignoring client value", async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    setSelectResults([{ projectId: "proj-REAL" }], [{ status: "active" }], [{ deadline: pastDate }]);
    const r = await castVote("prop-1", 1, "proj-FAKE", "csrf");
    expect(r).toEqual({ error: "Voting is closed — the project deadline has passed" });
  });

  it("returns error when proposal not found", async () => {
    setSelectResults([]);
    const r = await castVote("nonexistent", 1, "proj-1", "csrf");
    expect(r).toEqual({ error: "Proposal not found" });
  });

  it("returns error on DB failure", async () => {
    setSelectResults([{ projectId: "proj-1" }], [{ status: "active" }], []);
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
    setSelectResults([{ projectId: "proj-1" }], [{ status: "active" }], [{ deadline: pastDate }]);
    const r = await removeVote("prop-1", "proj-1", "csrf");
    expect(r).toEqual({ error: "Voting is closed — the project deadline has passed" });
  });

  it("rejects vote removal when project is archived", async () => {
    setSelectResults([{ projectId: "proj-1" }], [{ status: "archived" }]);
    const r = await removeVote("prop-1", "proj-1", "csrf");
    expect(r).toEqual({ error: "This project is archived and read-only" });
  });

  it("deletes the vote", async () => {
    setSelectResults([{ projectId: "proj-1" }], [{ status: "active" }], []);
    const r = await removeVote("prop-1", "proj-1", "csrf");
    expect(r).toEqual({ success: true });
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it("returns error when proposal not found", async () => {
    setSelectResults([]);
    const r = await removeVote("nonexistent", "proj-1", "csrf");
    expect(r).toEqual({ error: "Proposal not found" });
  });

  it("returns error on DB failure", async () => {
    setSelectResults([{ projectId: "proj-1" }], [{ status: "active" }], []);
    mockDeleteWhere.mockImplementation(() => {
      throw new Error("DB error");
    });
    const r = await removeVote("prop-1", "proj-1", "csrf");
    expect(r).toEqual({ error: "Failed to remove vote" });
  });
});
