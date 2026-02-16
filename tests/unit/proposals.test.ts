import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Types ──────────────────────────────────────────────────────────────────

/** Minimal user shape returned by requireAuth (matches drizzle InferSelectModel<typeof users>) */
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

/** Shape of values passed to proposals insert */
interface ProposalInsertValues {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  summary: string | null;
  userId: string;
}

/** Shape of values passed to votes insert */
interface VoteInsertValues {
  proposalId: string;
  userId: string;
  value: number;
}

/** Shape of values passed to comments insert */
interface CommentInsertValues {
  id: string;
  proposalId: string;
  parentId: string | null;
  content: string;
  userId: string;
}

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const mockRequireAuth = vi.fn<() => Promise<MockUser>>();
vi.mock("@/lib/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

const mockBuildProposalSummary = vi.fn<(title: string, description: string | null | undefined) => Promise<string | null>>();
vi.mock("@/lib/ai", () => ({
  buildProposalSummary: (...args: [string, string | null | undefined]) => mockBuildProposalSummary(...args),
}));

const mockEmitVoteChange = vi.fn();
vi.mock("@/lib/vote-events", () => ({
  emitVoteChange: (...args: unknown[]) => mockEmitVoteChange(...args),
}));

// Leaf-level recording mocks (only these get cleared between tests)
const mockInsertValues = vi.fn();
const mockOnConflictDoUpdate = vi.fn();
const mockDeleteWhere = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelectWhere = vi.fn();
const mockSelectLimit = vi.fn();

vi.mock("@/db", () => ({
  db: {
    // Use plain arrow functions for chain structure; only leaf fns are vi.fn()
    insert: () => ({
      values: (...args: unknown[]) => {
        mockInsertValues(...args);
        // Return a thenable that also exposes .onConflictDoUpdate()
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
              limit: () => mockSelectLimit(),
            };
          },
        };
      },
    }),
  },
}));

// ── Test helpers ────────────────────────────────────────────────────────────

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

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.set(key, value);
  }
  return fd;
}

// ── Import SUT (after mocks are wired) ─────────────────────────────────────

import {
  createProposal,
  deleteProposal,
  castVote,
  removeVote,
  addComment,
} from "@/app/projects/[id]/proposals/actions";

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockRevalidatePath.mockClear();
  mockRequireAuth.mockReset();
  mockBuildProposalSummary.mockReset();
  mockInsertValues.mockReset();
  mockOnConflictDoUpdate.mockClear();
  mockDeleteWhere.mockReset();
  mockSelectFrom.mockClear();
  mockSelectWhere.mockClear();
  mockSelectLimit.mockReset();
  mockEmitVoteChange.mockClear();

  // Default: authenticated member user
  mockRequireAuth.mockResolvedValue(makeUser());

  // Default: AI summary succeeds
  mockBuildProposalSummary.mockResolvedValue("AI-generated summary");

  // Default: selectLimit returns empty (no rows found)
  mockSelectLimit.mockReturnValue(Promise.resolve([]));
});

// ─── createProposal ────────────────────────────────────────────────────────

describe("createProposal", () => {
  const validFormData = () =>
    makeFormData({
      projectId: "proj-1",
      title: "My Proposal Title",
      description: "A detailed description of the proposal.",
      initialVote: "1",
    });

  it("should return error when user is not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));

    const result = await createProposal(null, validFormData());

    expect(result).toEqual({ error: "You must be logged in to create a proposal" });
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("should return error when viewer tries to create proposal", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ role: "viewer" }));

    const result = await createProposal(null, validFormData());

    expect(result).toEqual({ error: "You don't have permission to create proposals" });
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("should return validation error when title is too short", async () => {
    const fd = makeFormData({
      projectId: "proj-1",
      title: "Hi",
      description: "",
      initialVote: "1",
    });

    const result = await createProposal(null, fd);

    expect(result).toEqual({ error: "Title must be at least 5 characters" });
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("should return validation error when projectId is empty", async () => {
    const fd = makeFormData({
      projectId: "",
      title: "Valid Title Here",
      description: "",
      initialVote: "1",
    });

    const result = await createProposal(null, fd);

    expect(result).toHaveProperty("error");
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("should return validation error when initialVote is invalid", async () => {
    const fd = makeFormData({
      projectId: "proj-1",
      title: "Valid Title Here",
      description: "",
      initialVote: "99",
    });

    const result = await createProposal(null, fd);

    expect(result).toHaveProperty("error");
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("should create proposal, generate AI summary, and cast initial vote", async () => {
    const result = await createProposal(null, validFormData());

    expect(result).toEqual({ success: true });

    // AI summary was requested
    expect(mockBuildProposalSummary).toHaveBeenCalledWith(
      "My Proposal Title",
      "A detailed description of the proposal."
    );

    // Three inserts: proposal + vote + audit log
    expect(mockInsertValues).toHaveBeenCalledTimes(3);

    // First insert: proposal
    const proposalValues = mockInsertValues.mock.calls[0][0] as ProposalInsertValues;
    expect(proposalValues.projectId).toBe("proj-1");
    expect(proposalValues.title).toBe("My Proposal Title");
    expect(proposalValues.description).toBe("A detailed description of the proposal.");
    expect(proposalValues.summary).toBe("AI-generated summary");
    expect(proposalValues.userId).toBe("user-1");
    expect(proposalValues.id).toBeTruthy();

    // Second insert: vote
    const voteValues = mockInsertValues.mock.calls[1][0] as VoteInsertValues;
    expect(voteValues.proposalId).toBe(proposalValues.id);
    expect(voteValues.userId).toBe("user-1");
    expect(voteValues.value).toBe(1);

    // Path revalidated
    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects/proj-1");
  });

  it("should cast negative initial vote when initialVote is -1", async () => {
    const fd = makeFormData({
      projectId: "proj-1",
      title: "Negative Vote Proposal",
      description: "A description for negative vote",
      initialVote: "-1",
    });

    const result = await createProposal(null, fd);

    expect(result).toEqual({ success: true });

    const voteValues = mockInsertValues.mock.calls[1][0] as VoteInsertValues;
    expect(voteValues.value).toBe(-1);
  });

  it("should default initialVote to 1 when not provided", async () => {
    const fd = makeFormData({
      projectId: "proj-1",
      title: "Default Vote Proposal",
      description: "Some description",
    });

    const result = await createProposal(null, fd);

    expect(result).toEqual({ success: true });

    const voteValues = mockInsertValues.mock.calls[1][0] as VoteInsertValues;
    expect(voteValues.value).toBe(1);
  });

  it("should store null description when description is empty", async () => {
    const fd = makeFormData({
      projectId: "proj-1",
      title: "No Description Proposal",
      description: "",
      initialVote: "1",
    });

    const result = await createProposal(null, fd);

    expect(result).toEqual({ success: true });

    const proposalValues = mockInsertValues.mock.calls[0][0] as ProposalInsertValues;
    expect(proposalValues.description).toBeNull();
  });

  it("should return generic error when an unexpected error occurs", async () => {
    mockBuildProposalSummary.mockRejectedValue(new Error("LLM timeout"));

    const result = await createProposal(null, validFormData());

    expect(result).toEqual({ error: "Failed to create proposal. Please try again." });
  });
});

// ─── deleteProposal ────────────────────────────────────────────────────────

describe("deleteProposal", () => {
  it("should return error when user is not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));

    const result = await deleteProposal("prop-1", "proj-1");

    expect(result).toEqual({ error: "You must be logged in" });
    expect(mockDeleteWhere).not.toHaveBeenCalled();
  });

  it("should return error when member tries to delete (no permission)", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ role: "member" }));

    const result = await deleteProposal("prop-1", "proj-1");

    expect(result).toEqual({ error: "You don't have permission to delete proposals" });
    expect(mockDeleteWhere).not.toHaveBeenCalled();
  });

  it("should return error when proposal is not found", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ role: "manager" }));
    mockSelectLimit.mockReturnValue(Promise.resolve([]));

    const result = await deleteProposal("nonexistent", "proj-1");

    expect(result).toEqual({ error: "Proposal not found" });
    expect(mockDeleteWhere).not.toHaveBeenCalled();
  });

  it("should return error when manager is not the owner", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ id: "user-1", role: "manager" }));
    mockSelectLimit.mockReturnValue(
      Promise.resolve([{ id: "prop-1", userId: "other-user" }])
    );

    const result = await deleteProposal("prop-1", "proj-1");

    expect(result).toEqual({ error: "You don't have permission to delete this proposal" });
    expect(mockDeleteWhere).not.toHaveBeenCalled();
  });

  it("should delete proposal when manager is the owner", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ id: "user-1", role: "manager" }));
    mockSelectLimit.mockReturnValue(
      Promise.resolve([{ id: "prop-1", userId: "user-1" }])
    );

    const result = await deleteProposal("prop-1", "proj-1");

    expect(result).toEqual({ success: true });
    expect(mockDeleteWhere).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects/proj-1");
  });

  it("should delete proposal when user is admin even if not owner", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ id: "admin-1", role: "admin" }));
    mockSelectLimit.mockReturnValue(
      Promise.resolve([{ id: "prop-1", userId: "other-user" }])
    );

    const result = await deleteProposal("prop-1", "proj-1");

    expect(result).toEqual({ success: true });
    expect(mockDeleteWhere).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects/proj-1");
  });
});

// ─── castVote ──────────────────────────────────────────────────────────────

describe("castVote", () => {
  it("should return error when user is not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));

    const result = await castVote("prop-1", 1, "proj-1");

    expect(result).toEqual({ error: "You must be logged in to vote" });
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("should return error when viewer tries to vote", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ role: "viewer" }));

    const result = await castVote("prop-1", 1, "proj-1");

    expect(result).toEqual({ error: "You don't have permission to vote" });
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("should upsert a positive vote", async () => {
    const result = await castVote("prop-1", 1, "proj-1");

    expect(result).toEqual({ success: true });

    expect(mockInsertValues).toHaveBeenCalledWith({
      proposalId: "prop-1",
      userId: "user-1",
      value: 1,
    });

    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith({
      target: expect.arrayContaining([expect.anything(), expect.anything()]),
      set: { value: 1 },
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects/proj-1");
  });

  it("should upsert a negative vote", async () => {
    const result = await castVote("prop-1", -1, "proj-1");

    expect(result).toEqual({ success: true });

    expect(mockInsertValues).toHaveBeenCalledWith({
      proposalId: "prop-1",
      userId: "user-1",
      value: -1,
    });

    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ set: { value: -1 } })
    );
  });

  it("should return generic error when db operation fails", async () => {
    mockInsertValues.mockImplementation(() => {
      throw new Error("DB constraint violation");
    });

    const result = await castVote("prop-1", 1, "proj-1");

    expect(result).toEqual({ error: "Failed to cast vote" });
  });
});

// ─── removeVote ────────────────────────────────────────────────────────────

describe("removeVote", () => {
  it("should return error when user is not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));

    const result = await removeVote("prop-1", "proj-1");

    expect(result).toEqual({ error: "You must be logged in" });
    expect(mockDeleteWhere).not.toHaveBeenCalled();
  });

  it("should return error when viewer tries to remove vote", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ role: "viewer" }));

    const result = await removeVote("prop-1", "proj-1");

    expect(result).toEqual({ error: "You don't have permission to vote" });
    expect(mockDeleteWhere).not.toHaveBeenCalled();
  });

  it("should delete the vote for the authenticated user", async () => {
    const result = await removeVote("prop-1", "proj-1");

    expect(result).toEqual({ success: true });
    expect(mockDeleteWhere).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects/proj-1");
  });

  it("should return generic error when db operation fails", async () => {
    mockDeleteWhere.mockImplementation(() => {
      throw new Error("DB error");
    });

    const result = await removeVote("prop-1", "proj-1");

    expect(result).toEqual({ error: "Failed to remove vote" });
  });
});

// ─── addComment ────────────────────────────────────────────────────────────

describe("addComment", () => {
  const validCommentForm = () =>
    makeFormData({
      proposalId: "prop-1",
      content: "This is a thoughtful comment.",
      projectId: "proj-1",
    });

  it("should return error when user is not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));

    const result = await addComment(null, validCommentForm());

    expect(result).toEqual({ error: "You must be logged in to comment" });
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("should return error when viewer tries to comment", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ role: "viewer" }));

    const result = await addComment(null, validCommentForm());

    expect(result).toEqual({ error: "You don't have permission to comment" });
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("should return validation error when content is empty", async () => {
    const fd = makeFormData({
      proposalId: "prop-1",
      content: "",
      projectId: "proj-1",
    });

    const result = await addComment(null, fd);

    expect(result).toEqual({ error: "Comment cannot be empty" });
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("should return validation error when proposalId is empty", async () => {
    const fd = makeFormData({
      proposalId: "",
      content: "Some comment",
      projectId: "proj-1",
    });

    const result = await addComment(null, fd);

    expect(result).toHaveProperty("error");
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("should return validation error when content exceeds 2000 characters", async () => {
    const fd = makeFormData({
      proposalId: "prop-1",
      content: "x".repeat(2001),
      projectId: "proj-1",
    });

    const result = await addComment(null, fd);

    expect(result).toEqual({ error: "Comment too long" });
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("should create a top-level comment without parentId", async () => {
    const result = await addComment(null, validCommentForm());

    expect(result).toEqual({ success: true });

    const commentValues = mockInsertValues.mock.calls[0][0] as CommentInsertValues;
    expect(commentValues.proposalId).toBe("prop-1");
    expect(commentValues.content).toBe("This is a thoughtful comment.");
    expect(commentValues.parentId).toBeNull();
    expect(commentValues.userId).toBe("user-1");
    expect(commentValues.id).toBeTruthy();

    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects/proj-1");
  });

  it("should create a threaded reply with parentId", async () => {
    const fd = makeFormData({
      proposalId: "prop-1",
      content: "This is a reply.",
      parentId: "comment-parent-1",
      projectId: "proj-1",
    });

    const result = await addComment(null, fd);

    expect(result).toEqual({ success: true });

    const commentValues = mockInsertValues.mock.calls[0][0] as CommentInsertValues;
    expect(commentValues.parentId).toBe("comment-parent-1");
  });

  it("should not revalidate path when projectId is missing", async () => {
    const fd = makeFormData({
      proposalId: "prop-1",
      content: "Comment without project context",
    });

    const result = await addComment(null, fd);

    expect(result).toEqual({ success: true });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("should return generic error when db operation fails", async () => {
    mockInsertValues.mockImplementation(() => {
      throw new Error("DB error");
    });

    const result = await addComment(null, validCommentForm());

    expect(result).toEqual({ error: "Failed to post comment" });
  });
});
