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

interface CommentInsertValues {
  id: string;
  proposalId: string | null;
  projectId: string | null;
  parentId: string | null;
  content: string;
  userId: string;
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

const mockInsertValues = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelectWhere = vi.fn();
const mockSelectLimit = vi.fn();

vi.mock("@/db", () => ({
  db: {
    insert: () => ({
      values: (...args: unknown[]) => {
        mockInsertValues(...args);
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

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.set(key, value);
  return fd;
}

import { addComment } from "@/app/projects/[id]/proposals/comment-actions";

beforeEach(() => {
  mockRevalidatePath.mockClear();
  mockRequireAuth.mockReset();
  mockInsertValues.mockReset();
  mockSelectFrom.mockClear();
  mockSelectWhere.mockClear();
  mockSelectLimit.mockReset();
  mockRequireAuth.mockResolvedValue(makeUser());
  mockSelectLimit.mockReturnValue(Promise.resolve([]));
});

describe("addComment", () => {
  const proposalForm = () =>
    makeFormData({ proposalId: "prop-1", content: "Thoughtful comment." });

  const projectForm = () =>
    makeFormData({ projectId: "proj-1", content: "Project-level comment." });

  it("rejects unauthenticated users", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
    const r = await addComment(null, proposalForm());
    expect(r).toEqual({ error: "You must be logged in to comment" });
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("rejects viewers", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ role: "viewer" }));
    const r = await addComment(null, proposalForm());
    expect(r).toEqual({ error: "You don't have permission to comment" });
  });

  it("rejects empty content", async () => {
    const fd = makeFormData({ proposalId: "prop-1", content: "" });
    const r = await addComment(null, fd);
    expect(r).toEqual({ error: "Comment cannot be empty" });
  });

  it("rejects when neither proposalId nor projectId given", async () => {
    const fd = makeFormData({ content: "orphan" });
    const r = await addComment(null, fd);
    expect(r).toHaveProperty("error");
  });

  it("rejects when both proposalId and projectId given", async () => {
    const fd = makeFormData({
      proposalId: "prop-1",
      projectId: "proj-1",
      content: "ambiguous",
    });
    const r = await addComment(null, fd);
    expect(r).toHaveProperty("error");
  });

  it("rejects content over 2000 chars", async () => {
    const fd = makeFormData({ proposalId: "p", content: "x".repeat(2001) });
    const r = await addComment(null, fd);
    expect(r).toEqual({ error: "Comment too long" });
  });

  it("creates a proposal comment", async () => {
    const r = await addComment(null, proposalForm());
    expect(r).toEqual({ success: true });
    const v = mockInsertValues.mock.calls[0][0] as CommentInsertValues;
    expect(v.proposalId).toBe("prop-1");
    expect(v.projectId).toBeNull();
    expect(v.parentId).toBeNull();
  });

  it("creates a project-level comment", async () => {
    const r = await addComment(null, projectForm());
    expect(r).toEqual({ success: true });
    const v = mockInsertValues.mock.calls[0][0] as CommentInsertValues;
    expect(v.projectId).toBe("proj-1");
    expect(v.proposalId).toBeNull();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects/proj-1");
  });

  it("logs project_comment audit for project comments", async () => {
    await addComment(null, projectForm());
    const a = mockInsertValues.mock.calls[1][0] as { action: string };
    expect(a.action).toBe("project_comment");
  });

  it("logs comment audit for proposal comments", async () => {
    await addComment(null, proposalForm());
    const a = mockInsertValues.mock.calls[1][0] as { action: string };
    expect(a.action).toBe("comment");
  });

  it("creates threaded reply with valid parentId (proposal)", async () => {
    // 1. Proposal lookup for deadline → projectId
    mockSelectLimit.mockResolvedValueOnce([{ projectId: "proj-1" }]);
    // 2. Deadline check → no deadline
    mockSelectLimit.mockResolvedValueOnce([]);
    // 3. Parent comment lookup → same scope
    mockSelectLimit.mockResolvedValueOnce([
      { id: "parent-1", proposalId: "prop-1", projectId: null },
    ]);
    const fd = makeFormData({
      proposalId: "prop-1",
      content: "reply",
      parentId: "parent-1",
    });
    const r = await addComment(null, fd);
    expect(r).toEqual({ success: true });
    const v = mockInsertValues.mock.calls[0][0] as CommentInsertValues;
    expect(v.parentId).toBe("parent-1");
  });

  it("creates threaded reply with valid parentId (project)", async () => {
    // 1. Deadline check → no deadline
    mockSelectLimit.mockResolvedValueOnce([]);
    // 2. Parent comment lookup → same scope
    mockSelectLimit.mockResolvedValueOnce([
      { id: "parent-1", proposalId: null, projectId: "proj-1" },
    ]);
    const fd = makeFormData({
      projectId: "proj-1",
      content: "project reply",
      parentId: "parent-1",
    });
    const r = await addComment(null, fd);
    expect(r).toEqual({ success: true });
    const v = mockInsertValues.mock.calls[0][0] as CommentInsertValues;
    expect(v.parentId).toBe("parent-1");
  });

  it("rejects parentId that does not exist (proposal)", async () => {
    // 1. Proposal lookup → projectId
    mockSelectLimit.mockResolvedValueOnce([{ projectId: "proj-1" }]);
    // 2. Deadline check → no deadline
    mockSelectLimit.mockResolvedValueOnce([]);
    // 3. Parent comment lookup → not found (default [])
    mockSelectLimit.mockResolvedValueOnce([]);
    const fd = makeFormData({
      proposalId: "prop-1",
      content: "reply to ghost",
      parentId: "nonexistent",
    });
    const r = await addComment(null, fd);
    expect(r).toEqual({ error: "Parent comment not found" });
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("rejects parentId that does not exist (project)", async () => {
    // 1. Deadline check → no deadline
    mockSelectLimit.mockResolvedValueOnce([]);
    // 2. Parent comment lookup → not found
    mockSelectLimit.mockResolvedValueOnce([]);
    const fd = makeFormData({
      projectId: "proj-1",
      content: "reply to ghost",
      parentId: "nonexistent",
    });
    const r = await addComment(null, fd);
    expect(r).toEqual({ error: "Parent comment not found" });
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("rejects parentId from different proposal scope", async () => {
    // 1. Proposal lookup → projectId
    mockSelectLimit.mockResolvedValueOnce([{ projectId: "proj-1" }]);
    // 2. Deadline check → no deadline
    mockSelectLimit.mockResolvedValueOnce([]);
    // 3. Parent comment → different proposal
    mockSelectLimit.mockResolvedValueOnce([
      { id: "parent-1", proposalId: "prop-OTHER", projectId: null },
    ]);
    const fd = makeFormData({
      proposalId: "prop-1",
      content: "cross-scope reply",
      parentId: "parent-1",
    });
    const r = await addComment(null, fd);
    expect(r).toEqual({ error: "Parent comment belongs to a different scope" });
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("rejects parentId from different project scope", async () => {
    // 1. Deadline check → no deadline
    mockSelectLimit.mockResolvedValueOnce([]);
    // 2. Parent comment → different project
    mockSelectLimit.mockResolvedValueOnce([
      { id: "parent-1", proposalId: null, projectId: "proj-OTHER" },
    ]);
    const fd = makeFormData({
      projectId: "proj-1",
      content: "cross-scope reply",
      parentId: "parent-1",
    });
    const r = await addComment(null, fd);
    expect(r).toEqual({ error: "Parent comment belongs to a different scope" });
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("returns generic error on DB failure", async () => {
    mockInsertValues.mockImplementation(() => {
      throw new Error("DB error");
    });
    const r = await addComment(null, proposalForm());
    expect(r).toEqual({ error: "Failed to post comment" });
  });

  it("rejects proposal comment when project deadline has passed", async () => {
    const pastDeadline = new Date(Date.now() - 86400000); // yesterday
    // First select: proposal lookup returns projectId
    mockSelectLimit.mockResolvedValueOnce([{ projectId: "proj-1" }]);
    // Second select: project deadline lookup returns past deadline
    mockSelectLimit.mockResolvedValueOnce([{ deadline: pastDeadline }]);

    const fd = makeFormData({ proposalId: "prop-1", content: "Late comment" });
    const r = await addComment(null, fd);
    expect(r).toEqual({
      error: "Comments are closed — the project deadline has passed",
    });
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("allows proposal comment when project deadline is in the future", async () => {
    const futureDeadline = new Date(Date.now() + 86400000); // tomorrow
    // First select: proposal lookup returns projectId
    mockSelectLimit.mockResolvedValueOnce([{ projectId: "proj-1" }]);
    // Second select: project deadline lookup returns future deadline
    mockSelectLimit.mockResolvedValueOnce([{ deadline: futureDeadline }]);

    const fd = makeFormData({ proposalId: "prop-1", content: "Timely comment" });
    const r = await addComment(null, fd);
    expect(r).toEqual({ success: true });
  });
});
