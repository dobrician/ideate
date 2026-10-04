import { describe, it, expect, vi, beforeEach } from "vitest";

interface MockUser {
  id: string;
  email: string;
  passwordHash: string | null;
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

const mockVerifyPassword = vi.fn();
const mockHashPassword = vi.fn();
const mockValidatePassword = vi.fn();

const mockSendEmailChangeEmail = vi.fn();
vi.mock("@/lib/mail", () => ({
  sendEmailChangeEmail: (...args: unknown[]) => mockSendEmailChangeEmail(...args),
}));

vi.mock("@/lib/audit", () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));

const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn<() => Promise<void>>();
const mockSelectFrom = vi.fn();
const mockInsertValues = vi.fn();

vi.mock("@/db", () => ({
  db: {
    update: () => ({
      set: (...args: unknown[]) => {
        mockUpdateSet(...args);
        return { where: (...w: unknown[]) => { mockUpdateWhere(...w); return Promise.resolve(); } };
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => mockSelectFrom() }),
      }),
    }),
    insert: () => ({
      values: (...args: unknown[]) => {
        mockInsertValues(...args);
        return { onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) };
      },
    }),
  },
}));

vi.mock("jsonwebtoken", () => ({
  default: { sign: vi.fn(() => "mock-token") },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 10, retryAfterMs: 0 }) }));
vi.mock("@/lib/request-utils", () => ({ getActionClientIp: vi.fn().mockResolvedValue("127.0.0.1") }));

function makeUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user-1", email: "alice@test.com", passwordHash: "$2b$12$hash",
    firstName: "Alice", lastName: "Test", avatarUrl: null,
    role: "member", createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.set(key, value);
  return fd;
}

import { updateNotificationPreferences } from "@/app/profile/actions";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue(makeUser());
  mockValidatePassword.mockReturnValue({ valid: true });
  mockVerifyPassword.mockResolvedValue(true);
  mockHashPassword.mockResolvedValue("$2b$12$newhash");
  mockSelectFrom.mockResolvedValue([]);
  mockSendEmailChangeEmail.mockResolvedValue(undefined);
});

describe("updateNotificationPreferences", () => {
  it("updates preferences successfully", async () => {
    const result = await updateNotificationPreferences(
      { emailNewProposal: true, emailVoteOnMine: false, emailCommentReply: true, emailWeeklyDigest: false },
      "csrf-tok",
    );
    expect(result).toEqual({ success: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/profile");
  });

  it("returns error when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
    const result = await updateNotificationPreferences(
      { emailNewProposal: true, emailVoteOnMine: true, emailCommentReply: true, emailWeeklyDigest: true },
      "csrf-tok",
    );
    expect(result).toEqual({ error: "error.mustBeLoggedIn" });
  });

  it("returns generic error on unexpected failure", async () => {
    mockRequireAuth.mockRejectedValue(new Error("DB down"));
    const result = await updateNotificationPreferences(
      { emailNewProposal: true, emailVoteOnMine: true, emailCommentReply: true, emailWeeklyDigest: true },
      "csrf-tok",
    );
    expect(result).toEqual({ error: "error.unexpected" });
  });
});
