import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the cookies module
const mockCookies = {
  get: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookies)),
}));

describe("CSRF", () => {
  beforeEach(() => {
    vi.resetModules();
    mockCookies.get.mockReset();
    process.env.APP_URL = "http://localhost:3000";
  });

  describe("getCsrfToken", () => {
    it("should return CSRF token from cookie", async () => {
      mockCookies.get.mockReturnValue({ value: "test-csrf-token" });
      const { getCsrfToken } = await import("@/lib/csrf");
      const token = await getCsrfToken();
      expect(token).toBe("test-csrf-token");
      expect(mockCookies.get).toHaveBeenCalledWith("csrf_token");
    });

    it("should return null when no cookie exists", async () => {
      mockCookies.get.mockReturnValue(undefined);
      const { getCsrfToken } = await import("@/lib/csrf");
      const token = await getCsrfToken();
      expect(token).toBeNull();
    });

    it("should return null for empty cookie value", async () => {
      mockCookies.get.mockReturnValue({ value: "" });
      const { getCsrfToken } = await import("@/lib/csrf");
      const token = await getCsrfToken();
      expect(token).toBeNull();
    });
  });

  describe("validateCsrfToken", () => {
    it("should return true for matching tokens", async () => {
      mockCookies.get.mockReturnValue({ value: "valid-token" });
      const { validateCsrfToken } = await import("@/lib/csrf");
      const result = await validateCsrfToken("valid-token");
      expect(result).toBe(true);
    });

    it("should return false for mismatched tokens", async () => {
      mockCookies.get.mockReturnValue({ value: "valid-token" });
      const { validateCsrfToken } = await import("@/lib/csrf");
      const result = await validateCsrfToken("wrong-token");
      expect(result).toBe(false);
    });

    it("should return false when no cookie token exists", async () => {
      mockCookies.get.mockReturnValue(undefined);
      const { validateCsrfToken } = await import("@/lib/csrf");
      const result = await validateCsrfToken("some-token");
      expect(result).toBe(false);
    });

    it("should return false for empty submitted token", async () => {
      mockCookies.get.mockReturnValue({ value: "valid-token" });
      const { validateCsrfToken } = await import("@/lib/csrf");
      const result = await validateCsrfToken("");
      expect(result).toBe(false);
    });
  });

  describe("requireCsrfToken", () => {
    it("should not throw for valid token", async () => {
      mockCookies.get.mockReturnValue({ value: "valid-token" });
      const { requireCsrfToken } = await import("@/lib/csrf");
      await expect(requireCsrfToken("valid-token")).resolves.toBeUndefined();
    });

    it("should throw for invalid token", async () => {
      mockCookies.get.mockReturnValue({ value: "valid-token" });
      const { requireCsrfToken } = await import("@/lib/csrf");
      await expect(requireCsrfToken("wrong-token")).rejects.toThrow(
        "Invalid CSRF token"
      );
    });

    it("should throw when no cookie exists", async () => {
      mockCookies.get.mockReturnValue(undefined);
      const { requireCsrfToken } = await import("@/lib/csrf");
      await expect(requireCsrfToken("any-token")).rejects.toThrow(
        "Invalid CSRF token"
      );
    });
  });

  describe("validateOrigin", () => {
    it("should return true for same-origin request", async () => {
      const { validateOrigin } = await import("@/lib/csrf");
      const req = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      });
      expect(validateOrigin(req)).toBe(true);
    });

    it("should return false for cross-origin request", async () => {
      const { validateOrigin } = await import("@/lib/csrf");
      const req = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { origin: "https://evil.com" },
      });
      expect(validateOrigin(req)).toBe(false);
    });

    it("should return true when no Origin header (same-origin)", async () => {
      const { validateOrigin } = await import("@/lib/csrf");
      const req = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
      });
      expect(validateOrigin(req)).toBe(true);
    });
  });

  describe("requireOrigin", () => {
    it("should return null for valid same-origin request", async () => {
      const { requireOrigin } = await import("@/lib/csrf");
      const req = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      });
      expect(requireOrigin(req)).toBeNull();
    });

    it("should return 403 response for cross-origin request", async () => {
      const { requireOrigin } = await import("@/lib/csrf");
      const req = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { origin: "https://evil.com" },
      });
      const response = requireOrigin(req);
      expect(response).not.toBeNull();
      expect(response!.status).toBe(403);
      const data = await response!.json();
      expect(data.error).toContain("cross-origin");
    });
  });
});
