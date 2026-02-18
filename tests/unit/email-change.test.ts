import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Types ──────────────────────────────────────────────────────────────────

interface MockUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  passwordHash: string | null;
  role: "admin" | "manager" | "member" | "viewer";
  createdAt: Date | null;
  updatedAt: Date | null;
}

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockRequireAuth = vi.fn<() => Promise<MockUser>>();
vi.mock("@/lib/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/csrf", () => ({
  requireCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

const mockLogAudit = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/audit", () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

const mockSendEmailChangeEmail = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/mail", () => ({
  sendEmailChangeEmail: (...args: unknown[]) => mockSendEmailChangeEmail(...args),
}));

let mockSelectResult: { id: string }[] = [];
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn<() => Promise<void>>();

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(mockSelectResult),
        }),
      }),
    }),
    update: () => ({
      set: (...args: unknown[]) => {
        mockUpdateSet(...args);
        return {
          where: (...w: unknown[]) => {
            mockUpdateWhere(...w);
            return Promise.resolve();
          },
        };
      },
    }),
  },
}));

vi.mock("@/lib/password", () => ({
  validatePassword: () => ({ valid: true }),
  verifyPassword: () => Promise.resolve(true),
  hashPassword: () => Promise.resolve("$2a$12$newhash"),
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 10, retryAfterMs: 0 }) }));
vi.mock("@/lib/request-utils", () => ({ getActionClientIp: vi.fn().mockResolvedValue("127.0.0.1") }));

// ── Helpers ────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user-1",
    email: "alice@test.com",
    firstName: "Alice",
    lastName: "Test",
    avatarUrl: null,
    passwordHash: "$2a$12$hash",
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

// ── Import SUT ─────────────────────────────────────────────────────────────

import { requestEmailChange } from "@/app/profile/actions";

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockRequireAuth.mockReset();
  mockLogAudit.mockClear();
  mockSendEmailChangeEmail.mockClear();
  mockUpdateSet.mockReset();
  mockUpdateWhere.mockClear();
  mockSelectResult = [];
  mockRequireAuth.mockResolvedValue(makeUser());
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("requestEmailChange", () => {
  it("should return error when user is not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
    const fd = makeFormData({ newEmail: "new@test.com" });
    const result = await requestEmailChange(fd);
    expect(result).toEqual({ error: "error.mustBeLoggedIn" });
    expect(mockSendEmailChangeEmail).not.toHaveBeenCalled();
  });

  it("should return error for invalid email", async () => {
    const fd = makeFormData({ newEmail: "not-an-email" });
    const result = await requestEmailChange(fd);
    expect(result.error).toBeDefined();
    expect(mockSendEmailChangeEmail).not.toHaveBeenCalled();
  });

  it("should return sameEmail when new email matches current", async () => {
    const fd = makeFormData({ newEmail: "alice@test.com" });
    const result = await requestEmailChange(fd);
    expect(result).toEqual({ error: "sameEmail" });
  });

  it("should return emailInUse when email is taken", async () => {
    mockSelectResult = [{ id: "other-user" }];
    const fd = makeFormData({ newEmail: "taken@test.com" });
    const result = await requestEmailChange(fd);
    expect(result).toEqual({ error: "emailInUse" });
    expect(mockSendEmailChangeEmail).not.toHaveBeenCalled();
  });

  it("should send verification email on success", async () => {
    const fd = makeFormData({ newEmail: "new@test.com" });
    const result = await requestEmailChange(fd);
    expect(result).toEqual({ success: true });
    expect(mockSendEmailChangeEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmailChangeEmail.mock.calls[0][0]).toBe("new@test.com");
  });

  it("should log audit event on success", async () => {
    const fd = makeFormData({ newEmail: "new@test.com" });
    await requestEmailChange(fd);
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        action: "request_email_change",
        entity: "user",
      })
    );
  });

  it("should normalize email to lowercase", async () => {
    const fd = makeFormData({ newEmail: "NEW@TEST.COM" });
    const result = await requestEmailChange(fd);
    expect(result).toEqual({ success: true });
    expect(mockSendEmailChangeEmail.mock.calls[0][0]).toBe("new@test.com");
  });

  it("should return generic error on unexpected failure", async () => {
    mockSendEmailChangeEmail.mockRejectedValue(new Error("SMTP down"));
    const fd = makeFormData({ newEmail: "new@test.com" });
    const result = await requestEmailChange(fd);
    expect(result).toEqual({ error: "error.unexpected" });
  });
});
