import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db
const mockDbSelectResult: Record<string, unknown>[] = [];
const mockDbUpdateSet = vi.fn();
const mockDbUpdateWhere = vi.fn();
const mockDbInsertValues = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(mockDbSelectResult),
        }),
      }),
    }),
    insert: () => ({
      values: (data: unknown) => mockDbInsertValues(data),
    }),
    update: () => ({
      set: (data: unknown) => {
        mockDbUpdateSet(data);
        return {
          where: (cond: unknown) => mockDbUpdateWhere(cond),
        };
      },
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  users: {
    id: "id",
    email: "email",
    passwordHash: "password_hash",
    emailVerified: "email_verified",
    verificationToken: "verification_token",
    verificationTokenExpires: "verification_token_expires",
    resetToken: "reset_token",
    resetTokenExpires: "reset_token_expires",
  },
}));

describe("Password Module", () => {
  beforeEach(() => {
    vi.resetModules();
    mockDbUpdateSet.mockReset();
    mockDbUpdateWhere.mockReset();
    mockDbInsertValues.mockReset();
    mockDbSelectResult.length = 0;
  });

  describe("validatePassword", () => {
    it("should reject passwords shorter than 8 characters", async () => {
      const { validatePassword } = await import("@/lib/password");
      const result = validatePassword("Ab1");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("8 characters");
    });

    it("should reject passwords without uppercase letter", async () => {
      const { validatePassword } = await import("@/lib/password");
      const result = validatePassword("abcdefg1");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("uppercase");
    });

    it("should reject passwords without lowercase letter", async () => {
      const { validatePassword } = await import("@/lib/password");
      const result = validatePassword("ABCDEFG1");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("lowercase");
    });

    it("should reject passwords without a number", async () => {
      const { validatePassword } = await import("@/lib/password");
      const result = validatePassword("Abcdefgh");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("number");
    });

    it("should accept valid passwords", async () => {
      const { validatePassword } = await import("@/lib/password");
      const result = validatePassword("Password1");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept complex passwords", async () => {
      const { validatePassword } = await import("@/lib/password");
      const result = validatePassword("MyStr0ng!P@ssw0rd");
      expect(result.valid).toBe(true);
    });
  });

  describe("hashPassword and verifyPassword", () => {
    it("should hash and verify a password correctly", async () => {
      const { hashPassword, verifyPassword } = await import("@/lib/password");
      const password = "TestPassword123";
      const hash = await hashPassword(password);

      expect(hash).not.toBe(password);
      expect(hash.startsWith("$2")).toBe(true);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it("should reject incorrect password", async () => {
      const { hashPassword, verifyPassword } = await import("@/lib/password");
      const hash = await hashPassword("CorrectPassword1");
      const isValid = await verifyPassword("WrongPassword1", hash);
      expect(isValid).toBe(false);
    });
  });

  describe("generateSecureToken", () => {
    it("should generate a 64-character hex string", async () => {
      const { generateSecureToken } = await import("@/lib/password");
      const token = generateSecureToken();
      expect(token).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(token)).toBe(true);
    });

    it("should generate unique tokens", async () => {
      const { generateSecureToken } = await import("@/lib/password");
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe("registerUser", () => {
    it("should create a new user with password", async () => {
      mockDbInsertValues.mockResolvedValue(undefined);

      const { registerUser } = await import("@/lib/password");
      const result = await registerUser("new@example.com", "Password123");

      expect(result.userId).toBeDefined();
      expect(result.verificationToken).toBeDefined();
      expect(result.verificationToken).toHaveLength(64);
      expect(mockDbInsertValues).toHaveBeenCalledTimes(1);
    });

    it("should throw if email already has a password", async () => {
      mockDbSelectResult.push({
        id: "existing-user",
        email: "existing@example.com",
        passwordHash: "$2b$12$somehash",
      });

      const { registerUser } = await import("@/lib/password");
      await expect(
        registerUser("existing@example.com", "Password123")
      ).rejects.toThrow("Email already registered");
    });

    it("should add password to existing magic-link user", async () => {
      mockDbSelectResult.push({
        id: "magic-user",
        email: "magic@example.com",
        passwordHash: null,
      });
      mockDbUpdateWhere.mockResolvedValue(undefined);

      const { registerUser } = await import("@/lib/password");
      const result = await registerUser("magic@example.com", "Password123");

      expect(result.userId).toBe("magic-user");
      expect(result.verificationToken).toBeDefined();
      expect(mockDbUpdateSet).toHaveBeenCalledTimes(1);
    });
  });

  describe("authenticateWithPassword", () => {
    it("should return null for non-existent user", async () => {
      const { authenticateWithPassword } = await import("@/lib/password");
      const result = await authenticateWithPassword(
        "nobody@example.com",
        "Password123"
      );
      expect(result).toBeNull();
    });

    it("should return null for user without password", async () => {
      mockDbSelectResult.push({
        id: "magic-user",
        email: "magic@example.com",
        passwordHash: null,
      });

      const { authenticateWithPassword } = await import("@/lib/password");
      const result = await authenticateWithPassword(
        "magic@example.com",
        "Password123"
      );
      expect(result).toBeNull();
    });

    it("should authenticate with correct password", async () => {
      const { hashPassword, authenticateWithPassword } = await import(
        "@/lib/password"
      );
      const hash = await hashPassword("Password123");
      mockDbSelectResult.push({
        id: "user-123",
        email: "user@example.com",
        passwordHash: hash,
        emailVerified: true,
      });

      const result = await authenticateWithPassword(
        "user@example.com",
        "Password123"
      );
      expect(result).not.toBeNull();
      expect(result?.userId).toBe("user-123");
      expect(result?.emailVerified).toBe(true);
    });

    it("should reject incorrect password", async () => {
      const { hashPassword, authenticateWithPassword } = await import(
        "@/lib/password"
      );
      const hash = await hashPassword("CorrectPassword1");
      mockDbSelectResult.push({
        id: "user-123",
        email: "user@example.com",
        passwordHash: hash,
        emailVerified: true,
      });

      const result = await authenticateWithPassword(
        "user@example.com",
        "WrongPassword1"
      );
      expect(result).toBeNull();
    });
  });

  describe("verifyEmailToken", () => {
    it("should return null for invalid token", async () => {
      const { verifyEmailToken } = await import("@/lib/password");
      const result = await verifyEmailToken("invalid-token");
      expect(result).toBeNull();
    });

    it("should return null for expired token", async () => {
      mockDbSelectResult.push({
        id: "user-123",
        email: "user@example.com",
        verificationToken: "valid-token",
        verificationTokenExpires: new Date(Date.now() - 1000),
      });

      const { verifyEmailToken } = await import("@/lib/password");
      const result = await verifyEmailToken("valid-token");
      expect(result).toBeNull();
    });

    it("should verify email and clear token", async () => {
      mockDbSelectResult.push({
        id: "user-123",
        email: "user@example.com",
        verificationToken: "valid-token",
        verificationTokenExpires: new Date(Date.now() + 86400000),
      });
      mockDbUpdateWhere.mockResolvedValue(undefined);

      const { verifyEmailToken } = await import("@/lib/password");
      const email = await verifyEmailToken("valid-token");
      expect(email).toBe("user@example.com");
      expect(mockDbUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          emailVerified: true,
          verificationToken: null,
          verificationTokenExpires: null,
        })
      );
    });
  });

  describe("generatePasswordResetToken", () => {
    it("should return null for non-existent user", async () => {
      const { generatePasswordResetToken } = await import("@/lib/password");
      const result = await generatePasswordResetToken("nobody@example.com");
      expect(result).toBeNull();
    });

    it("should generate reset token for existing user", async () => {
      mockDbSelectResult.push({
        id: "user-123",
        email: "user@example.com",
      });
      mockDbUpdateWhere.mockResolvedValue(undefined);

      const { generatePasswordResetToken } = await import("@/lib/password");
      const token = await generatePasswordResetToken("user@example.com");
      expect(token).toBeDefined();
      expect(token).toHaveLength(64);
    });
  });

  describe("resetPasswordWithToken", () => {
    it("should return null for invalid token", async () => {
      const { resetPasswordWithToken } = await import("@/lib/password");
      const result = await resetPasswordWithToken(
        "invalid-token",
        "NewPassword1"
      );
      expect(result).toBeNull();
    });

    it("should return null for expired token", async () => {
      mockDbSelectResult.push({
        id: "user-123",
        email: "user@example.com",
        resetToken: "expired-token",
        resetTokenExpires: new Date(Date.now() - 1000),
      });

      const { resetPasswordWithToken } = await import("@/lib/password");
      const result = await resetPasswordWithToken(
        "expired-token",
        "NewPassword1"
      );
      expect(result).toBeNull();
    });

    it("should reset password and clear token", async () => {
      mockDbSelectResult.push({
        id: "user-123",
        email: "user@example.com",
        resetToken: "valid-token",
        resetTokenExpires: new Date(Date.now() + 3600000),
      });
      mockDbUpdateWhere.mockResolvedValue(undefined);

      const { resetPasswordWithToken } = await import("@/lib/password");
      const email = await resetPasswordWithToken(
        "valid-token",
        "NewPassword1"
      );
      expect(email).toBe("user@example.com");
      expect(mockDbUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          emailVerified: true,
          resetToken: null,
          resetTokenExpires: null,
        })
      );
    });
  });

  describe("regenerateVerificationToken", () => {
    it("should return null for non-existent user", async () => {
      const { regenerateVerificationToken } = await import("@/lib/password");
      const result = await regenerateVerificationToken("nobody@example.com");
      expect(result).toBeNull();
    });

    it("should generate new verification token", async () => {
      mockDbSelectResult.push({
        id: "user-123",
        email: "user@example.com",
      });
      mockDbUpdateWhere.mockResolvedValue(undefined);

      const { regenerateVerificationToken } = await import("@/lib/password");
      const token = await regenerateVerificationToken("user@example.com");
      expect(token).toBeDefined();
      expect(token).toHaveLength(64);
    });
  });
});
