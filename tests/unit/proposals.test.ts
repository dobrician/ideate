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

interface ProposalInsertValues {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  summary: string | null;
  userId: string;
}

interface VoteInsertValues {
  proposalId: string;
  userId: string;
  value: number;
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

const mockBuildProposalSummary = vi.fn<
  (t: string, d: string | null | undefined) => Promise<string | null>
>();
vi.mock("@/lib/ai", () => ({
  buildProposalSummary: (...args: [string, string | null | undefined]) =>
    mockBuildProposalSummary(...args),
}));

vi.mock("@/lib/vote-events", () => ({
  emitVoteChange: vi.fn(),
}));

const mockInsertValues = vi.fn();
const mockSelectLimit = vi.fn();

vi.mock("@/db", () => ({
  db: {
    insert: () => ({
      values: (...args: unknown[]) => {
        mockInsertValues(...args);
        return {
          onConflictDoUpdate: () => Promise.resolve(),
          then: (
            resolve: (v: undefined) => void,
            reject?: (e: unknown) => void
          ) => Promise.resolve(undefined).then(resolve, reject),
        };
      },
    }),
    delete: () => ({ where: () => Promise.resolve() }),
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => mockSelectLimit() }),
      }),
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

import { createProposal } from "@/app/projects/[id]/proposals/actions";

beforeEach(() => {
  mockRevalidatePath.mockClear();
  mockRequireAuth.mockReset();
  mockBuildProposalSummary.mockReset();
  mockInsertValues.mockReset();
  mockSelectLimit.mockReset();
  mockRequireAuth.mockResolvedValue(makeUser());
  mockBuildProposalSummary.mockResolvedValue("AI-generated summary");
  mockSelectLimit.mockResolvedValue([]);
});

describe("createProposal", () => {
  const validFormData = () =>
    makeFormData({
      projectId: "proj-1",
      title: "My Proposal Title",
      description: "A detailed description of the proposal.",
      initialVote: "1",
    });

  it("rejects unauthenticated users", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
    const result = await createProposal(null, validFormData());
    expect(result).toEqual({ error: "You must be logged in to create a proposal" });
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("rejects viewers", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ role: "viewer" }));
    const result = await createProposal(null, validFormData());
    expect(result).toEqual({ error: "You don't have permission to create proposals" });
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("rejects short titles", async () => {
    const fd = makeFormData({
      projectId: "proj-1",
      title: "Hi",
      description: "",
      initialVote: "1",
    });
    const result = await createProposal(null, fd);
    expect(result).toEqual({ error: "Title must be at least 5 characters" });
  });

  it("rejects empty projectId", async () => {
    const fd = makeFormData({
      projectId: "",
      title: "Valid Title Here",
      description: "",
      initialVote: "1",
    });
    const result = await createProposal(null, fd);
    expect(result).toHaveProperty("error");
  });

  it("rejects invalid initialVote", async () => {
    const fd = makeFormData({
      projectId: "proj-1",
      title: "Valid Title Here",
      description: "",
      initialVote: "99",
    });
    const result = await createProposal(null, fd);
    expect(result).toHaveProperty("error");
  });

  it("creates proposal with AI summary and initial vote", async () => {
    const result = await createProposal(null, validFormData());
    expect(result).toEqual({ success: true });

    expect(mockBuildProposalSummary).toHaveBeenCalledWith(
      "My Proposal Title",
      "A detailed description of the proposal."
    );

    expect(mockInsertValues).toHaveBeenCalledTimes(3);

    const proposalValues = mockInsertValues.mock.calls[0][0] as ProposalInsertValues;
    expect(proposalValues.projectId).toBe("proj-1");
    expect(proposalValues.title).toBe("My Proposal Title");
    expect(proposalValues.summary).toBe("AI-generated summary");

    const voteValues = mockInsertValues.mock.calls[1][0] as VoteInsertValues;
    expect(voteValues.proposalId).toBe(proposalValues.id);
    expect(voteValues.value).toBe(1);

    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects/proj-1");
  });

  it("casts negative initial vote when -1", async () => {
    const fd = makeFormData({
      projectId: "proj-1",
      title: "Negative Vote Proposal",
      description: "A description",
      initialVote: "-1",
    });
    const result = await createProposal(null, fd);
    expect(result).toEqual({ success: true });
    const voteValues = mockInsertValues.mock.calls[1][0] as VoteInsertValues;
    expect(voteValues.value).toBe(-1);
  });

  it("defaults initialVote to 1", async () => {
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

  it("stores null description when empty", async () => {
    const fd = makeFormData({
      projectId: "proj-1",
      title: "No Description Proposal",
      description: "",
      initialVote: "1",
    });
    const result = await createProposal(null, fd);
    expect(result).toEqual({ success: true });
    const v = mockInsertValues.mock.calls[0][0] as ProposalInsertValues;
    expect(v.description).toBeNull();
  });

  it("returns generic error on unexpected failure", async () => {
    mockBuildProposalSummary.mockRejectedValue(new Error("LLM timeout"));
    const result = await createProposal(null, validFormData());
    expect(result).toEqual({ error: "Failed to create proposal. Please try again." });
  });

  it("returns Forbidden error message from CSRF rejection", async () => {
    const { requireCsrfToken } = await import("@/lib/csrf");
    vi.mocked(requireCsrfToken).mockRejectedValueOnce(
      new Error("Forbidden: Invalid CSRF token")
    );
    const result = await createProposal(null, validFormData());
    expect(result).toEqual({ error: "Forbidden: Invalid CSRF token" });
  });

  it("rejects proposal when project deadline has passed", async () => {
    const pastDeadline = new Date(Date.now() - 86400000);
    mockSelectLimit.mockResolvedValueOnce([{ deadline: pastDeadline }]);
    const result = await createProposal(null, validFormData());
    expect(result).toEqual({
      error: "Proposals are closed — the project deadline has passed",
    });
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("allows proposal when project deadline is in the future", async () => {
    const futureDeadline = new Date(Date.now() + 86400000);
    mockSelectLimit.mockResolvedValueOnce([{ deadline: futureDeadline }]);
    const result = await createProposal(null, validFormData());
    expect(result).toEqual({ success: true });
  });
});
