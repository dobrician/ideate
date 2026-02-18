import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests that server actions return "Too many requests" when rate-limited.
 */

const mockCheckRateLimit = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...a: unknown[]) => mockCheckRateLimit(...a),
}));
vi.mock("@/lib/request-utils", () => ({
  getActionClientIp: vi.fn().mockResolvedValue("127.0.0.1"),
}));
vi.mock("@/lib/csrf", () => ({
  requireCsrfToken: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    id: "u1", email: "a@t.com", firstName: "A", lastName: "T",
    avatarUrl: null, role: "member", createdAt: new Date(), updatedAt: new Date(),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); },
}));
vi.mock("@/lib/webhooks", () => ({
  fireWebhookEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/project-utils", () => ({
  isDeadlinePassed: vi.fn().mockResolvedValue(false),
  isProjectArchived: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/mail", () => ({
  sendEmailChangeEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/ai", () => ({
  buildProposalSummary: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/vote-update", () => ({
  emitVoteUpdate: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/notifications", () => ({
  notifyVote: vi.fn().mockResolvedValue(undefined),
  notifyComment: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/rbac", () => ({
  hasPermission: vi.fn().mockReturnValue(true),
  canManageResource: vi.fn().mockReturnValue(true),
}));

vi.mock("@/db", () => ({
  db: {
    insert: () => ({
      values: () => ({ onConflictDoUpdate: () => Promise.resolve() }),
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    delete: () => ({ where: () => Promise.resolve() }),
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([]) }),
      }),
    }),
  },
}));

const blocked = { allowed: false, remaining: 0, retryAfterMs: 59000 };
const allowed = { allowed: true, remaining: 10, retryAfterMs: 0 };
const mkFD = (e: Record<string, string>) => {
  const fd = new FormData();
  Object.entries(e).forEach(([k, v]) => fd.set(k, v));
  return fd;
};
const futureDate = new Date(Date.now() + 7 * 86400000)
  .toISOString()
  .split("T")[0];

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockReturnValue(allowed);
});

const RL_ERROR = { error: "Too many requests — please try again later" };

// ─── Project actions ───────────────────────────────────────────────────

describe("project actions rate limiting", () => {
  it("createProject rejects when rate-limited", async () => {
    mockCheckRateLimit.mockReturnValueOnce(blocked);
    const { createProject } = await import("@/app/projects/actions");
    const result = await createProject(
      mkFD({ title: "Test", description: "ok", deadline: futureDate })
    );
    expect(result).toEqual(RL_ERROR);
  });

  it("updateProject rejects when rate-limited", async () => {
    mockCheckRateLimit.mockReturnValueOnce(blocked);
    const { updateProject } = await import("@/app/projects/actions");
    const result = await updateProject(
      "p1",
      mkFD({ title: "T", description: "ok", deadline: futureDate, status: "active" })
    );
    expect(result).toEqual(RL_ERROR);
  });

  it("deleteProject rejects when rate-limited", async () => {
    mockCheckRateLimit.mockReturnValueOnce(blocked);
    const { deleteProject } = await import("@/app/projects/actions");
    expect(await deleteProject("p1")).toEqual(RL_ERROR);
  });

  it("unarchiveProject rejects when rate-limited", async () => {
    mockCheckRateLimit.mockReturnValueOnce(blocked);
    const { unarchiveProject } = await import("@/app/projects/actions");
    expect(await unarchiveProject("p1")).toEqual(RL_ERROR);
  });
});

// ─── Proposal / vote actions ───────────────────────────────────────────

describe("proposal/vote actions rate limiting", () => {
  it("createProposal rejects when rate-limited", async () => {
    mockCheckRateLimit.mockReturnValueOnce(blocked);
    const { createProposal } = await import(
      "@/app/projects/[id]/proposals/actions"
    );
    const fd = mkFD({ projectId: "p1", title: "My Idea", description: "ok", initialVote: "1" });
    const result = await createProposal(null, fd);
    expect(result).toEqual(RL_ERROR);
  });

  it("deleteProposal rejects when rate-limited", async () => {
    mockCheckRateLimit.mockReturnValueOnce(blocked);
    const { deleteProposal } = await import(
      "@/app/projects/[id]/proposals/actions"
    );
    expect(await deleteProposal("prop1")).toEqual(RL_ERROR);
  });

  it("castVote rejects when rate-limited", async () => {
    mockCheckRateLimit.mockReturnValueOnce(blocked);
    const { castVote } = await import(
      "@/app/projects/[id]/proposals/actions"
    );
    expect(await castVote("prop1", 1)).toEqual(RL_ERROR);
  });

  it("removeVote rejects when rate-limited", async () => {
    mockCheckRateLimit.mockReturnValueOnce(blocked);
    const { removeVote } = await import(
      "@/app/projects/[id]/proposals/actions"
    );
    expect(await removeVote("prop1")).toEqual(RL_ERROR);
  });
});

// ─── Comment actions ───────────────────────────────────────────────────

describe("comment actions rate limiting", () => {
  it("addComment rejects when rate-limited", async () => {
    mockCheckRateLimit.mockReturnValueOnce(blocked);
    const { addComment } = await import(
      "@/app/projects/[id]/proposals/comment-actions"
    );
    const fd = mkFD({ projectId: "p1", content: "hello" });
    const result = await addComment(null, fd);
    expect(result).toEqual(RL_ERROR);
  });
});

// ─── Profile actions ───────────────────────────────────────────────────

describe("profile actions rate limiting", () => {
  it("updateProfile rejects when rate-limited", async () => {
    mockCheckRateLimit.mockReturnValueOnce(blocked);
    const { updateProfile } = await import("@/app/profile/actions");
    expect(await updateProfile(mkFD({ firstName: "Bob" }))).toEqual(RL_ERROR);
  });

  it("changePassword rejects when rate-limited", async () => {
    mockCheckRateLimit.mockReturnValueOnce(blocked);
    const { changePassword } = await import("@/app/profile/actions");
    const fd = mkFD({
      currentPassword: "old", newPassword: "new", confirmPassword: "new",
    });
    expect(await changePassword(fd)).toEqual(RL_ERROR);
  });

  it("updateNotificationPreferences rejects when rate-limited", async () => {
    mockCheckRateLimit.mockReturnValueOnce(blocked);
    const { updateNotificationPreferences } = await import(
      "@/app/profile/actions"
    );
    expect(await updateNotificationPreferences(mkFD({}))).toEqual(RL_ERROR);
  });

  it("requestEmailChange rejects when rate-limited", async () => {
    mockCheckRateLimit.mockReturnValueOnce(blocked);
    const { requestEmailChange } = await import("@/app/profile/actions");
    expect(await requestEmailChange(mkFD({ newEmail: "b@t.com" }))).toEqual(
      RL_ERROR
    );
  });
});
