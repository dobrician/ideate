import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockLogAudit = vi.fn();
const mockAuthenticateWithPassword = vi.fn();
const mockSetSessionCookie = vi.fn();
const mockClearSession = vi.fn();
const mockGetSession = vi.fn();
const mockVerifyMagicLinkToken = vi.fn();
const mockFindOrCreateUser = vi.fn();
const mockVerifyEmailToken = vi.fn();
const mockRegenerateVerificationToken = vi.fn();
const mockGenerateMagicLink = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockSendMagicLinkEmail = vi.fn();
const mockSendVerificationEmail = vi.fn();

vi.mock("@/lib/audit", () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

vi.mock("@/lib/password", () => ({
  authenticateWithPassword: (...args: unknown[]) => mockAuthenticateWithPassword(...args),
  verifyEmailToken: (...args: unknown[]) => mockVerifyEmailToken(...args),
  regenerateVerificationToken: (...args: unknown[]) => mockRegenerateVerificationToken(...args),
}));

vi.mock("@/lib/auth", () => ({
  setSessionCookie: (...args: unknown[]) => mockSetSessionCookie(...args),
  clearSession: (...args: unknown[]) => mockClearSession(...args),
  getSession: (...args: unknown[]) => mockGetSession(...args),
  verifyMagicLinkToken: (...args: unknown[]) => mockVerifyMagicLinkToken(...args),
  findOrCreateUser: (...args: unknown[]) => mockFindOrCreateUser(...args),
  generateMagicLink: (...args: unknown[]) => mockGenerateMagicLink(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

vi.mock("@/lib/csrf", () => ({
  requireOrigin: () => null,
}));

vi.mock("@/lib/mail", () => ({
  sendMagicLinkEmail: (...args: unknown[]) => mockSendMagicLinkEmail(...args),
  sendVerificationEmail: (...args: unknown[]) => mockSendVerificationEmail(...args),
}));

// ── Import route handlers ────────────────────────────────────────────────────

import { POST as logoutPOST } from "@/app/auth/logout/route";
import { GET as verifyGET } from "@/app/auth/verify/route";
import { POST as verifyEmailPOST } from "@/app/api/auth/verify-email/route";
import { POST as requestPOST } from "@/app/auth/request/route";
import { POST as resendPOST } from "@/app/api/auth/resend-verification/route";
import { POST as loginPOST } from "@/app/api/auth/login-password/route";

// ── Helpers ──────────────────────────────────────────────────────────────────

function createPostRequest(path: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createGetRequest(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 5, retryAfterMs: 0 });
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Audit logging integration across auth routes", () => {
  describe("POST /auth/logout", () => {
    it("should audit log on logout with userId from session", async () => {
      mockGetSession.mockResolvedValue({ userId: "user-1", email: "u@e.com" });
      mockClearSession.mockResolvedValue(undefined);

      const req = createPostRequest("/auth/logout", {});
      await logoutPOST(req);

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-1", action: "logout", entity: "session" })
      );
    });

    it("should audit log with null userId when no session", async () => {
      mockGetSession.mockResolvedValue(null);
      mockClearSession.mockResolvedValue(undefined);

      const req = createPostRequest("/auth/logout", {});
      await logoutPOST(req);

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({ userId: null, action: "logout", entity: "session" })
      );
    });
  });

  describe("GET /auth/verify (magic link)", () => {
    it("should audit log magic_link_verify on success", async () => {
      mockVerifyMagicLinkToken.mockReturnValue("user@example.com");
      mockFindOrCreateUser.mockResolvedValue("user-1");
      mockSetSessionCookie.mockResolvedValue(undefined);

      const req = createGetRequest("/auth/verify?token=valid-jwt");
      await verifyGET(req);

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-1", action: "magic_link_verify", entity: "session" })
      );
    });

    it("should not audit log on invalid token", async () => {
      mockVerifyMagicLinkToken.mockReturnValue(null);

      const req = createGetRequest("/auth/verify?token=bad");
      await verifyGET(req);

      expect(mockLogAudit).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/auth/verify-email", () => {
    it("should audit log verify_email on success", async () => {
      mockVerifyEmailToken.mockResolvedValue("user@example.com");

      const req = createPostRequest("/api/auth/verify-email", { token: "valid" });
      await verifyEmailPOST(req);

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "verify_email", entity: "user", details: "email=user@example.com" })
      );
    });

    it("should not audit log on invalid token", async () => {
      mockVerifyEmailToken.mockResolvedValue(null);

      const req = createPostRequest("/api/auth/verify-email", { token: "bad" });
      await verifyEmailPOST(req);

      expect(mockLogAudit).not.toHaveBeenCalled();
    });
  });

  describe("POST /auth/request (magic link)", () => {
    it("should audit log magic_link_request on success", async () => {
      mockGenerateMagicLink.mockReturnValue("http://localhost:3000/auth/verify?token=abc");
      mockSendMagicLinkEmail.mockResolvedValue(undefined);

      const req = createPostRequest("/auth/request", { email: "user@example.com" });
      await requestPOST(req);

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "magic_link_request", entity: "session" })
      );
    });
  });

  describe("POST /api/auth/resend-verification", () => {
    it("should audit log resend_verification on success", async () => {
      mockRegenerateVerificationToken.mockResolvedValue("new-token");
      mockSendVerificationEmail.mockResolvedValue(undefined);

      const req = createPostRequest("/api/auth/resend-verification", { email: "user@example.com" });
      await resendPOST(req);

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "resend_verification", entity: "user" })
      );
    });
  });

  describe("POST /api/auth/login-password", () => {
    it("should audit log login on success", async () => {
      mockAuthenticateWithPassword.mockResolvedValue({ userId: "user-1", emailVerified: true });
      mockSetSessionCookie.mockResolvedValue(undefined);

      const req = createPostRequest("/api/auth/login-password", { email: "u@e.com", password: "Pass1234" });
      await loginPOST(req);

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-1", action: "login", entity: "session" })
      );
    });

    it("should audit log login_failed on bad credentials", async () => {
      mockAuthenticateWithPassword.mockResolvedValue(null);

      const req = createPostRequest("/api/auth/login-password", { email: "u@e.com", password: "Wrong1" });
      await loginPOST(req);

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "login_failed", entity: "session" })
      );
    });
  });
});
