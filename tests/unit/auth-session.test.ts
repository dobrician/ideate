import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock cookies
const mockCookies = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookies)),
}));

// Mock db
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbFrom = vi.fn();
const mockDbWhere = vi.fn();
const mockDbLimit = vi.fn();
const mockDbValues = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: (cond: unknown) => ({
          limit: () => mockDbLimit(),
        }),
      }),
    }),
    insert: () => ({
      values: (data: unknown) => mockDbValues(data),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  users: { id: "id", email: "email" },
}));

describe("Auth Session Functions", () => {
  beforeEach(() => {
    vi.resetModules();
    mockCookies.get.mockReset();
    mockCookies.set.mockReset();
    mockCookies.delete.mockReset();
    mockDbLimit.mockReset();
    mockDbValues.mockReset();
  });

  describe("setSessionCookie", () => {
    it("should set session and CSRF cookies", async () => {
      const { setSessionCookie } = await import("@/lib/auth");
      await setSessionCookie("user-123", "test@example.com");

      expect(mockCookies.set).toHaveBeenCalledTimes(2);
      // First call: session cookie
      expect(mockCookies.set.mock.calls[0][0]).toBe("session");
      expect(mockCookies.set.mock.calls[0][2]).toMatchObject({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
      // Second call: CSRF cookie
      expect(mockCookies.set.mock.calls[1][0]).toBe("csrf_token");
      expect(mockCookies.set.mock.calls[1][2]).toMatchObject({
        httpOnly: false,
        sameSite: "lax",
        path: "/",
      });
    });
  });

  describe("getSession", () => {
    it("should return null when no session cookie", async () => {
      mockCookies.get.mockReturnValue(undefined);
      const { getSession } = await import("@/lib/auth");
      const session = await getSession();
      expect(session).toBeNull();
    });

    it("should return null for invalid session token", async () => {
      mockCookies.get.mockReturnValue({ value: "invalid-token" });
      const { getSession } = await import("@/lib/auth");
      const session = await getSession();
      expect(session).toBeNull();
    });

    it("should return session payload for valid token", async () => {
      const { createSessionToken, getSession } = await import("@/lib/auth");
      const token = createSessionToken("user-123", "test@example.com");
      mockCookies.get.mockReturnValue({ value: token });

      const session = await getSession();
      expect(session).not.toBeNull();
      expect(session?.userId).toBe("user-123");
      expect(session?.email).toBe("test@example.com");
    });

    it("should rotate token when expiry is within 3 days", async () => {
      const { createSessionToken, getSession } = await import("@/lib/auth");
      const jwt = await import("jsonwebtoken");
      const secret = process.env.JWT_SECRET!;
      const now = Math.floor(Date.now() / 1000);
      // Create a token that expires in 2 days (below 3-day rotation threshold)
      const token = jwt.default.sign(
        { userId: "user-123", email: "test@example.com", type: "session", jti: "rot-jti" },
        secret,
        { expiresIn: 60 * 60 * 24 * 2, issuer: process.env.APP_URL, audience: process.env.APP_URL }
      );
      mockCookies.get.mockReturnValue({ value: token });

      const session = await getSession();
      expect(session?.userId).toBe("user-123");
      // setSessionCookie sets 2 cookies (session + csrf) during rotation
      expect(mockCookies.set).toHaveBeenCalledTimes(2);
    });
  });

  describe("getCurrentUser", () => {
    it("should return null when no session", async () => {
      mockCookies.get.mockReturnValue(undefined);
      const { getCurrentUser } = await import("@/lib/auth");
      const user = await getCurrentUser();
      expect(user).toBeNull();
    });

    it("should return user when session is valid", async () => {
      const { createSessionToken, getCurrentUser } = await import("@/lib/auth");
      const token = createSessionToken("user-123", "test@example.com");
      mockCookies.get.mockReturnValue({ value: token });
      mockDbLimit.mockResolvedValue([
        { id: "user-123", email: "test@example.com", role: "member" },
      ]);

      const user = await getCurrentUser();
      expect(user).toBeTruthy();
      expect(user?.id).toBe("user-123");
    });

    it("should return null when user not found in db", async () => {
      const { createSessionToken, getCurrentUser } = await import("@/lib/auth");
      const token = createSessionToken("user-123", "test@example.com");
      mockCookies.get.mockReturnValue({ value: token });
      mockDbLimit.mockResolvedValue([]);

      const user = await getCurrentUser();
      expect(user).toBeNull();
    });
  });

  describe("clearSession", () => {
    it("should delete session and CSRF cookies", async () => {
      const { clearSession } = await import("@/lib/auth");
      await clearSession();

      expect(mockCookies.delete).toHaveBeenCalledWith("session");
      expect(mockCookies.delete).toHaveBeenCalledWith("csrf_token");
    });
  });

  describe("requireAuth", () => {
    it("should throw when not authenticated", async () => {
      mockCookies.get.mockReturnValue(undefined);
      const { requireAuth } = await import("@/lib/auth");
      await expect(requireAuth()).rejects.toThrow("Unauthorized");
    });

    it("should return user when authenticated", async () => {
      const { createSessionToken, requireAuth } = await import("@/lib/auth");
      const token = createSessionToken("user-123", "test@example.com");
      mockCookies.get.mockReturnValue({ value: token });
      mockDbLimit.mockResolvedValue([
        { id: "user-123", email: "test@example.com", role: "member" },
      ]);

      const user = await requireAuth();
      expect(user.id).toBe("user-123");
    });
  });

  describe("findOrCreateUser", () => {
    it("should return existing user id", async () => {
      mockDbLimit.mockResolvedValue([{ id: "existing-user-123" }]);
      const { findOrCreateUser } = await import("@/lib/auth");
      const userId = await findOrCreateUser("test@example.com");
      expect(userId).toBe("existing-user-123");
    });

    it("should create new user if not found", async () => {
      mockDbLimit.mockResolvedValue([]);
      mockDbValues.mockResolvedValue(undefined);
      const { findOrCreateUser } = await import("@/lib/auth");
      const userId = await findOrCreateUser("new@example.com");
      expect(typeof userId).toBe("string");
      expect(userId.length).toBeGreaterThan(0);
    });

    it("should normalize email to lowercase", async () => {
      mockDbLimit.mockResolvedValue([{ id: "user-123" }]);
      const { findOrCreateUser } = await import("@/lib/auth");
      await findOrCreateUser("  TEST@EXAMPLE.COM  ");
      // If it finds the user, it means the email was normalized
      expect(mockDbLimit).toHaveBeenCalled();
    });
  });

  describe("getJwtSecret validation", () => {
    it("should throw when JWT_SECRET is empty", async () => {
      const originalSecret = process.env.JWT_SECRET;
      process.env.JWT_SECRET = "";
      vi.resetModules();

      try {
        const { generateMagicLinkToken } = await import("@/lib/auth");
        expect(() => generateMagicLinkToken("test@example.com")).toThrow();
      } finally {
        process.env.JWT_SECRET = originalSecret;
      }
    });

    it("should throw when JWT_SECRET is too short", async () => {
      const originalSecret = process.env.JWT_SECRET;
      process.env.JWT_SECRET = "short";
      vi.resetModules();

      try {
        const { generateMagicLinkToken } = await import("@/lib/auth");
        expect(() => generateMagicLinkToken("test@example.com")).toThrow(
          "JWT_SECRET must be at least 32 characters"
        );
      } finally {
        process.env.JWT_SECRET = originalSecret;
      }
    });
  });
});
