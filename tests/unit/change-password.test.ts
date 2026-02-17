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

const mockVerifyPassword = vi.fn<(password: string, hash: string) => Promise<boolean>>();
const mockHashPassword = vi.fn<(password: string) => Promise<string>>();
const mockValidatePassword = vi.fn<(password: string) => { valid: boolean; error?: string }>();

vi.mock("@/lib/password", () => ({
  verifyPassword: (...args: [string, string]) => mockVerifyPassword(...args),
  hashPassword: (...args: [string]) => mockHashPassword(...args),
  validatePassword: (...args: [string]) => mockValidatePassword(...args),
}));

const mockLogAudit = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/audit", () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn<() => Promise<void>>();

vi.mock("@/db", () => ({
  db: {
    update: () => ({
      set: (...args: unknown[]) => {
        mockUpdateSet(...args);
        return {
          where: (...whereArgs: unknown[]) => {
            mockUpdateWhere(...whereArgs);
            return Promise.resolve();
          },
        };
      },
    }),
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user-1",
    email: "alice@test.com",
    firstName: "Alice",
    lastName: "Test",
    avatarUrl: null,
    passwordHash: "$2a$12$hashedpassword",
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

import { changePassword } from "@/app/profile/actions";

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockRevalidatePath.mockClear();
  mockRequireAuth.mockReset();
  mockUpdateSet.mockReset();
  mockUpdateWhere.mockClear();
  mockVerifyPassword.mockReset();
  mockHashPassword.mockReset();
  mockValidatePassword.mockReset();
  mockLogAudit.mockClear();

  mockRequireAuth.mockResolvedValue(makeUser());
  mockValidatePassword.mockReturnValue({ valid: true });
  mockVerifyPassword.mockResolvedValue(true);
  mockHashPassword.mockResolvedValue("$2a$12$newhash");
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("changePassword", () => {
  it("should return error when user is not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));

    const fd = makeFormData({
      currentPassword: "OldPass1",
      newPassword: "NewPass1",
      confirmPassword: "NewPass1",
    });

    const result = await changePassword(fd);

    expect(result).toEqual({ error: "You must be logged in" });
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it("should return error when passwords do not match", async () => {
    const fd = makeFormData({
      currentPassword: "OldPass1",
      newPassword: "NewPass1",
      confirmPassword: "DifferentPass1",
    });

    const result = await changePassword(fd);

    expect(result).toEqual({ error: "passwordMismatch" });
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it("should return error when new password fails validation", async () => {
    mockValidatePassword.mockReturnValue({
      valid: false,
      error: "Password must be at least 8 characters",
    });

    const fd = makeFormData({
      currentPassword: "OldPass1",
      newPassword: "short",
      confirmPassword: "short",
    });

    const result = await changePassword(fd);

    expect(result).toEqual({ error: "Password must be at least 8 characters" });
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it("should return error when user has no password set", async () => {
    mockRequireAuth.mockResolvedValue(makeUser({ passwordHash: null }));

    const fd = makeFormData({
      currentPassword: "OldPass1",
      newPassword: "NewPass1",
      confirmPassword: "NewPass1",
    });

    const result = await changePassword(fd);

    expect(result).toEqual({ error: "noPasswordSet" });
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it("should return error when current password is incorrect", async () => {
    mockVerifyPassword.mockResolvedValue(false);

    const fd = makeFormData({
      currentPassword: "WrongPass1",
      newPassword: "NewPass1",
      confirmPassword: "NewPass1",
    });

    const result = await changePassword(fd);

    expect(result).toEqual({ error: "incorrectPassword" });
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it("should change password successfully", async () => {
    const fd = makeFormData({
      currentPassword: "OldPass1",
      newPassword: "NewPass1",
      confirmPassword: "NewPass1",
    });

    const result = await changePassword(fd);

    expect(result).toEqual({ success: true });

    expect(mockHashPassword).toHaveBeenCalledWith("NewPass1");
    expect(mockUpdateSet).toHaveBeenCalledTimes(1);
    const setArg = mockUpdateSet.mock.calls[0][0];
    expect(setArg.passwordHash).toBe("$2a$12$newhash");
    expect(setArg.updatedAt).toBeInstanceOf(Date);
    expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
  });

  it("should log audit event on successful password change", async () => {
    const fd = makeFormData({
      currentPassword: "OldPass1",
      newPassword: "NewPass1",
      confirmPassword: "NewPass1",
    });

    await changePassword(fd);

    expect(mockLogAudit).toHaveBeenCalledWith({
      userId: "user-1",
      action: "change_password",
      entity: "user",
      entityId: "user-1",
    });
  });

  it("should return generic error on DB failure", async () => {
    mockUpdateSet.mockImplementation(() => {
      throw new Error("DB connection lost");
    });

    const fd = makeFormData({
      currentPassword: "OldPass1",
      newPassword: "NewPass1",
      confirmPassword: "NewPass1",
    });

    const result = await changePassword(fd);

    expect(result).toEqual({ error: "Failed to change password" });
  });

  it("should return validation error when currentPassword is empty", async () => {
    const fd = makeFormData({
      currentPassword: "",
      newPassword: "NewPass1",
      confirmPassword: "NewPass1",
    });

    const result = await changePassword(fd);

    expect(result.error).toBeDefined();
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it("should verify against the correct user's password hash", async () => {
    const specificUser = makeUser({ id: "user-42", passwordHash: "$2a$12$specifichash" });
    mockRequireAuth.mockResolvedValue(specificUser);

    const fd = makeFormData({
      currentPassword: "OldPass1",
      newPassword: "NewPass1",
      confirmPassword: "NewPass1",
    });

    await changePassword(fd);

    expect(mockVerifyPassword).toHaveBeenCalledWith("OldPass1", "$2a$12$specifichash");
  });
});
