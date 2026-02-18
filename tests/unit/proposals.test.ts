import { describe, it, expect, vi, beforeEach } from "vitest";

interface MockUser {
  id: string; email: string; firstName: string | null; lastName: string | null;
  avatarUrl: string | null; role: "admin" | "manager" | "member" | "viewer";
  createdAt: Date | null; updatedAt: Date | null;
}

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => mockRevalidatePath(...a) }));
const mockRequireAuth = vi.fn<() => Promise<MockUser>>();
vi.mock("@/lib/auth", () => ({ requireAuth: (...a: unknown[]) => mockRequireAuth(...a) }));
vi.mock("@/lib/csrf", () => ({ requireCsrfToken: vi.fn().mockResolvedValue(undefined) }));
const mockBuildSummary = vi.fn().mockResolvedValue("AI summary");
vi.mock("@/lib/ai", () => ({ buildProposalSummary: (...a: unknown[]) => mockBuildSummary(...a) }));
vi.mock("@/lib/vote-events", () => ({ emitVoteChange: vi.fn() }));
vi.mock("@/lib/vote-update", () => ({ emitVoteUpdate: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/notifications", () => ({ notifyVote: vi.fn() }));
const mockFireWebhook = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/webhooks", () => ({ fireWebhookEvent: (...a: unknown[]) => mockFireWebhook(...a) }));

const mockInsert = vi.fn(), mockSelLim = vi.fn(), mockDelWhere = vi.fn();
vi.mock("@/db", () => ({
  db: {
    insert: () => ({ values: (...a: unknown[]) => {
      mockInsert(...a);
      return { onConflictDoUpdate: () => Promise.resolve(),
        then: (res: (v: undefined) => void, rej?: (e: unknown) => void) =>
          Promise.resolve(undefined).then(res, rej) };
    } }),
    delete: () => ({ where: (...a: unknown[]) => { mockDelWhere(...a); return Promise.resolve(); } }),
    select: () => ({ from: () => ({ where: () => ({ limit: () => mockSelLim() }) }) }),
  },
}));

const mkUser = (o: Partial<MockUser> = {}): MockUser => ({
  id: "user-1", email: "a@t.com", firstName: "A", lastName: "T",
  avatarUrl: null, role: "member", createdAt: new Date(), updatedAt: new Date(), ...o,
});
const mkFD = (e: Record<string, string>) => {
  const fd = new FormData(); Object.entries(e).forEach(([k, v]) => fd.set(k, v)); return fd;
};
const future = () => [{ projectId: "proj-1" }] as const;
const active = () => [{ status: "active" }] as const;
const alive = () => [{ deadline: new Date(Date.now() + 86400000) }] as const;
const past = () => [{ deadline: new Date(Date.now() - 86400000) }] as const;
const setupLive = () => { mockSelLim.mockResolvedValueOnce(future()).mockResolvedValueOnce(active()).mockResolvedValueOnce(alive()); };

import { createProposal, deleteProposal, castVote, removeVote } from "@/app/projects/[id]/proposals/actions";

beforeEach(() => {
  [mockRevalidatePath, mockInsert, mockSelLim, mockDelWhere, mockFireWebhook].forEach(m => m.mockReset());
  mockFireWebhook.mockResolvedValue(undefined);
  mockRequireAuth.mockReset().mockResolvedValue(mkUser());
  mockBuildSummary.mockReset().mockResolvedValue("AI summary");
  mockSelLim.mockResolvedValue([]);
});

describe("createProposal", () => {
  const vfd = () => mkFD({ projectId: "proj-1", title: "My Proposal Title", description: "Desc.", initialVote: "1" });

  it("rejects unauthenticated", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
    expect(await createProposal(null, vfd())).toEqual({ error: "You must be logged in to create a proposal" });
  });
  it("rejects viewers", async () => {
    mockRequireAuth.mockResolvedValue(mkUser({ role: "viewer" }));
    expect(await createProposal(null, vfd())).toEqual({ error: "You don't have permission to create proposals" });
  });
  it("rejects short titles", async () => {
    expect(await createProposal(null, mkFD({ projectId: "p", title: "Hi", description: "", initialVote: "1" }))).toEqual({ error: "Title must be at least 5 characters" });
  });
  it("rejects empty projectId", async () => {
    expect(await createProposal(null, mkFD({ projectId: "", title: "Valid Title", description: "", initialVote: "1" }))).toHaveProperty("error");
  });
  it("rejects archived projects", async () => {
    mockSelLim.mockResolvedValueOnce([{ status: "archived" }]);
    expect(await createProposal(null, vfd())).toEqual({ error: "This project is archived and read-only" });
  });
  it("rejects past-deadline projects", async () => {
    mockSelLim.mockResolvedValueOnce(active()).mockResolvedValueOnce(past());
    expect(await createProposal(null, vfd())).toEqual({ error: "Proposals are closed — the project deadline has passed" });
  });
  it("creates with AI summary and initial vote", async () => {
    expect(await createProposal(null, vfd())).toEqual({ success: true });
    expect(mockInsert).toHaveBeenCalledTimes(3);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects/proj-1");
  });
  it("stores null description when empty", async () => {
    await createProposal(null, mkFD({ projectId: "p1", title: "No Desc Here", description: "", initialVote: "1" }));
    expect((mockInsert.mock.calls[0][0] as { description: string | null }).description).toBeNull();
  });
  it("returns generic error on failure", async () => {
    mockBuildSummary.mockRejectedValue(new Error("LLM timeout"));
    expect(await createProposal(null, vfd())).toEqual({ error: "Failed to create proposal. Please try again." });
  });
  it("succeeds even when webhook rejects", async () => {
    mockFireWebhook.mockRejectedValue(new Error("webhook down"));
    expect(await createProposal(null, vfd())).toEqual({ success: true });
  });
  it("returns Forbidden from CSRF rejection", async () => {
    const { requireCsrfToken } = await import("@/lib/csrf");
    vi.mocked(requireCsrfToken).mockRejectedValueOnce(new Error("Forbidden: Invalid CSRF token"));
    expect(await createProposal(null, vfd())).toEqual({ error: "Forbidden: Invalid CSRF token" });
  });
});

describe("deleteProposal", () => {
  const owned = { id: "prop-1", title: "T", userId: "user-1", projectId: "proj-1" };
  beforeEach(() => { mockRequireAuth.mockResolvedValue(mkUser({ role: "manager" })); });
  it("rejects unauthenticated", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
    expect(await deleteProposal("prop-1", "proj-1", "t")).toEqual({ error: "You must be logged in" });
  });
  it("rejects viewers", async () => {
    mockRequireAuth.mockResolvedValue(mkUser({ role: "viewer" }));
    expect(await deleteProposal("prop-1", "proj-1", "t")).toEqual({ error: "You don't have permission to delete proposals" });
  });
  it("returns not found", async () => {
    mockSelLim.mockResolvedValueOnce([]);
    expect(await deleteProposal("prop-1", "proj-1", "t")).toEqual({ error: "Proposal not found" });
  });
  it("rejects non-owner", async () => {
    mockSelLim.mockResolvedValueOnce([{ ...owned, userId: "other" }]);
    expect(await deleteProposal("prop-1", "proj-1", "t")).toEqual({ error: "You don't have permission to delete this proposal" });
  });
  it("deletes owned proposal", async () => {
    mockSelLim.mockResolvedValueOnce([owned]);
    expect(await deleteProposal("prop-1", "proj-1", "t")).toEqual({ success: true });
    expect(mockDelWhere).toHaveBeenCalled();
  });
  it("returns generic error on DB failure", async () => {
    mockSelLim.mockResolvedValueOnce([owned]);
    mockDelWhere.mockImplementation(() => { throw new Error("DB"); });
    expect(await deleteProposal("prop-1", "proj-1", "t")).toEqual({ error: "Failed to delete proposal" });
  });
});

describe("castVote", () => {
  it("rejects unauthenticated", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
    expect(await castVote("p1", 1, "pj1", "t")).toEqual({ error: "You must be logged in to vote" });
  });
  it("rejects viewers", async () => {
    mockRequireAuth.mockResolvedValue(mkUser({ role: "viewer" }));
    expect(await castVote("p1", 1, "pj1", "t")).toEqual({ error: "You don't have permission to vote" });
  });
  it("rejects invalid value", async () => {
    expect(await castVote("p1", 5, "pj1", "t")).toEqual({ error: "Invalid vote value — must be 1 or -1" });
  });
  it("rejects missing proposal", async () => {
    mockSelLim.mockResolvedValueOnce([]);
    expect(await castVote("p1", 1, "pj1", "t")).toEqual({ error: "Proposal not found" });
  });
  it("rejects archived project", async () => {
    mockSelLim.mockResolvedValueOnce(future()).mockResolvedValueOnce([{ status: "archived" }]);
    expect(await castVote("p1", 1, "pj1", "t")).toEqual({ error: "This project is archived and read-only" });
  });
  it("rejects past deadline", async () => {
    mockSelLim.mockResolvedValueOnce(future()).mockResolvedValueOnce(active()).mockResolvedValueOnce(past());
    expect(await castVote("p1", 1, "pj1", "t")).toEqual({ error: "Voting is closed — the project deadline has passed" });
  });
  it("casts upvote", async () => {
    setupLive();
    expect(await castVote("p1", 1, "pj1", "t")).toEqual({ success: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects/proj-1");
  });
  it("succeeds even when webhook rejects", async () => {
    setupLive();
    mockFireWebhook.mockRejectedValue(new Error("webhook down"));
    expect(await castVote("p1", 1, "pj1", "t")).toEqual({ success: true });
  });
  it("returns generic error on DB failure", async () => {
    setupLive();
    mockInsert.mockImplementation(() => { throw new Error("DB"); });
    expect(await castVote("p1", 1, "pj1", "t")).toEqual({ error: "Failed to cast vote" });
  });
});

describe("removeVote", () => {
  it("rejects unauthenticated", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
    expect(await removeVote("p1", "pj1", "t")).toEqual({ error: "You must be logged in" });
  });
  it("rejects viewers", async () => {
    mockRequireAuth.mockResolvedValue(mkUser({ role: "viewer" }));
    expect(await removeVote("p1", "pj1", "t")).toEqual({ error: "You don't have permission to vote" });
  });
  it("rejects missing proposal", async () => {
    mockSelLim.mockResolvedValueOnce([]);
    expect(await removeVote("p1", "pj1", "t")).toEqual({ error: "Proposal not found" });
  });
  it("rejects archived project", async () => {
    mockSelLim.mockResolvedValueOnce(future()).mockResolvedValueOnce([{ status: "archived" }]);
    expect(await removeVote("p1", "pj1", "t")).toEqual({ error: "This project is archived and read-only" });
  });
  it("removes vote", async () => {
    setupLive();
    expect(await removeVote("p1", "pj1", "t")).toEqual({ success: true });
    expect(mockDelWhere).toHaveBeenCalled();
  });
  it("returns generic error on DB failure", async () => {
    setupLive();
    mockDelWhere.mockImplementation(() => { throw new Error("DB"); });
    expect(await removeVote("p1", "pj1", "t")).toEqual({ error: "Failed to remove vote" });
  });
});
