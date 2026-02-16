import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRegisterUser = vi.fn();
const mockValidatePassword = vi.fn();
const mockAuthenticateWithPassword = vi.fn();
const mockVerifyEmailToken = vi.fn();
const mockGeneratePasswordResetToken = vi.fn();
const mockResetPasswordWithToken = vi.fn();
const mockSendVerificationEmail = vi.fn();
const mockSendPasswordResetEmail = vi.fn();
const mockSetSessionCookie = vi.fn();
const mockCheckRateLimit = vi.fn();

vi.mock("@/lib/password", () => ({
  registerUser: (...args: unknown[]) => mockRegisterUser(...args),
  validatePassword: (...args: unknown[]) => mockValidatePassword(...args),
  authenticateWithPassword: (...args: unknown[]) =>
    mockAuthenticateWithPassword(...args),
  verifyEmailToken: (...args: unknown[]) => mockVerifyEmailToken(...args),
  generatePasswordResetToken: (...args: unknown[]) =>
    mockGeneratePasswordResetToken(...args),
  resetPasswordWithToken: (...args: unknown[]) =>
    mockResetPasswordWithToken(...args),
}));

vi.mock("@/lib/mail", () => ({
  sendVerificationEmail: (...args: unknown[]) =>
    mockSendVerificationEmail(...args),
  sendPasswordResetEmail: (...args: unknown[]) =>
    mockSendPasswordResetEmail(...args),
}));

vi.mock("@/lib/auth", () => ({
  setSessionCookie: (...args: unknown[]) => mockSetSessionCookie(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

vi.mock("@/lib/csrf", () => ({
  requireOrigin: () => null, // Allow all requests in tests
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(),
}));

// ── Import route handlers ────────────────────────────────────────────────────

import { POST as registerPOST } from "@/app/api/auth/register/route";
import { POST as loginPasswordPOST } from "@/app/api/auth/login-password/route";
import { POST as verifyEmailPOST } from "@/app/api/auth/verify-email/route";
import { POST as forgotPasswordPOST } from "@/app/api/auth/forgot-password/route";
import { POST as resetPasswordPOST } from "@/app/api/auth/reset-password/route";

// ── Helpers ──────────────────────────────────────────────────────────────────

function createPostRequest(
  path: string,
  body: Record<string, unknown>
): NextRequest {
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
  // Default: rate limits allow all requests
  mockCheckRateLimit.mockReturnValue({
    allowed: true,
    remaining: 5,
    retryAfterMs: 0,
  });
  // Default: password validation passes
  mockValidatePassword.mockReturnValue({ valid: true });
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /auth/register", () => {
  it("should register a new user successfully", async () => {
    mockRegisterUser.mockResolvedValue({
      userId: "user-1",
      verificationToken: "token-abc",
    });
    mockSendVerificationEmail.mockResolvedValue(undefined);

    const req = createPostRequest("/auth/register", {
      email: "new@example.com",
      password: "TestPass1",
      confirmPassword: "TestPass1",
    });
    const res = await registerPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockRegisterUser).toHaveBeenCalledWith("new@example.com", "TestPass1");
    expect(mockSendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it("should return 400 for invalid email", async () => {
    const req = createPostRequest("/auth/register", {
      email: "not-an-email",
      password: "TestPass1",
      confirmPassword: "TestPass1",
    });
    const res = await registerPOST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when passwords dont match", async () => {
    const req = createPostRequest("/auth/register", {
      email: "user@example.com",
      password: "TestPass1",
      confirmPassword: "Different1",
    });
    const res = await registerPOST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("match");
  });

  it("should return 400 for weak password", async () => {
    mockValidatePassword.mockReturnValue({
      valid: false,
      error: "Password must be at least 8 characters",
    });

    const req = createPostRequest("/auth/register", {
      email: "user@example.com",
      password: "weak",
      confirmPassword: "weak",
    });
    const res = await registerPOST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("8 characters");
  });

  it("should return 409 when email already registered", async () => {
    mockRegisterUser.mockRejectedValue(new Error("Email already registered"));

    const req = createPostRequest("/auth/register", {
      email: "taken@example.com",
      password: "TestPass1",
      confirmPassword: "TestPass1",
    });
    const res = await registerPOST(req);
    expect(res.status).toBe(409);
  });

  it("should return 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
      retryAfterMs: 5000,
    });

    const req = createPostRequest("/auth/register", {
      email: "user@example.com",
      password: "TestPass1",
      confirmPassword: "TestPass1",
    });
    const res = await registerPOST(req);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("5");
  });
});

describe("POST /auth/login-password", () => {
  it("should login successfully with valid credentials", async () => {
    mockAuthenticateWithPassword.mockResolvedValue({
      userId: "user-1",
      emailVerified: true,
    });
    mockSetSessionCookie.mockResolvedValue(undefined);

    const req = createPostRequest("/auth/login-password", {
      email: "user@example.com",
      password: "TestPass1",
    });
    const res = await loginPasswordPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockSetSessionCookie).toHaveBeenCalledWith(
      "user-1",
      "user@example.com"
    );
  });

  it("should return 401 for invalid credentials", async () => {
    mockAuthenticateWithPassword.mockResolvedValue(null);

    const req = createPostRequest("/auth/login-password", {
      email: "user@example.com",
      password: "WrongPass1",
    });
    const res = await loginPasswordPOST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain("Invalid");
  });

  it("should return 403 when email not verified", async () => {
    mockAuthenticateWithPassword.mockResolvedValue({
      userId: "user-1",
      emailVerified: false,
    });

    const req = createPostRequest("/auth/login-password", {
      email: "user@example.com",
      password: "TestPass1",
    });
    const res = await loginPasswordPOST(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("should return 400 for missing fields", async () => {
    const req = createPostRequest("/auth/login-password", {
      email: "user@example.com",
    });
    const res = await loginPasswordPOST(req);
    expect(res.status).toBe(400);
  });

  it("should return 429 when IP rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
      retryAfterMs: 10000,
    });

    const req = createPostRequest("/auth/login-password", {
      email: "user@example.com",
      password: "TestPass1",
    });
    const res = await loginPasswordPOST(req);
    expect(res.status).toBe(429);
  });

  it("should apply per-email rate limit", async () => {
    // First call (IP check) passes, second call (email check) fails
    mockCheckRateLimit
      .mockReturnValueOnce({ allowed: true, remaining: 10, retryAfterMs: 0 })
      .mockReturnValueOnce({
        allowed: false,
        remaining: 0,
        retryAfterMs: 3000,
      });

    const req = createPostRequest("/auth/login-password", {
      email: "user@example.com",
      password: "TestPass1",
    });
    const res = await loginPasswordPOST(req);
    expect(res.status).toBe(429);
  });
});

describe("POST /api/auth/verify-email", () => {
  it("should return success on valid token", async () => {
    mockVerifyEmailToken.mockResolvedValue("user@example.com");

    const req = createPostRequest("/api/auth/verify-email", {
      token: "valid-token-123",
    });
    const res = await verifyEmailPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("should return 400 for invalid token", async () => {
    mockVerifyEmailToken.mockResolvedValue(null);

    const req = createPostRequest("/api/auth/verify-email", {
      token: "bad-token",
    });
    const res = await verifyEmailPOST(req);

    expect(res.status).toBe(400);
  });

  it("should return 400 when token is missing", async () => {
    const req = createPostRequest("/api/auth/verify-email", {});
    const res = await verifyEmailPOST(req);

    expect(res.status).toBe(400);
  });

  it("should return 500 on verification error", async () => {
    mockVerifyEmailToken.mockRejectedValue(new Error("DB error"));

    const req = createPostRequest("/api/auth/verify-email", {
      token: "crash-token",
    });
    const res = await verifyEmailPOST(req);

    expect(res.status).toBe(500);
  });
});

describe("POST /auth/forgot-password", () => {
  it("should return success even if user does not exist (anti-enumeration)", async () => {
    mockGeneratePasswordResetToken.mockResolvedValue(null);

    const req = createPostRequest("/auth/forgot-password", {
      email: "nobody@example.com",
    });
    const res = await forgotPasswordPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("should send reset email when user exists", async () => {
    mockGeneratePasswordResetToken.mockResolvedValue("reset-token-abc");
    mockSendPasswordResetEmail.mockResolvedValue(undefined);

    const req = createPostRequest("/auth/forgot-password", {
      email: "user@example.com",
    });
    const res = await forgotPasswordPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it("should return 400 for invalid email", async () => {
    const req = createPostRequest("/auth/forgot-password", {
      email: "not-valid",
    });
    const res = await forgotPasswordPOST(req);
    expect(res.status).toBe(400);
  });

  it("should return 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
      retryAfterMs: 5000,
    });

    const req = createPostRequest("/auth/forgot-password", {
      email: "user@example.com",
    });
    const res = await forgotPasswordPOST(req);
    expect(res.status).toBe(429);
  });

  it("should return success (not 429) when per-email rate limited", async () => {
    // First call (IP) passes, second call (email) fails
    mockCheckRateLimit
      .mockReturnValueOnce({ allowed: true, remaining: 5, retryAfterMs: 0 })
      .mockReturnValueOnce({
        allowed: false,
        remaining: 0,
        retryAfterMs: 3000,
      });

    const req = createPostRequest("/auth/forgot-password", {
      email: "user@example.com",
    });
    const res = await forgotPasswordPOST(req);
    const data = await res.json();

    // Returns success to prevent email enumeration
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });
});

describe("POST /auth/reset-password", () => {
  it("should reset password successfully", async () => {
    mockResetPasswordWithToken.mockResolvedValue("user@example.com");

    const req = createPostRequest("/auth/reset-password", {
      token: "valid-reset-token",
      password: "NewPass1",
      confirmPassword: "NewPass1",
    });
    const res = await resetPasswordPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockResetPasswordWithToken).toHaveBeenCalledWith(
      "valid-reset-token",
      "NewPass1"
    );
  });

  it("should return 400 for invalid/expired token", async () => {
    mockResetPasswordWithToken.mockResolvedValue(null);

    const req = createPostRequest("/auth/reset-password", {
      token: "expired-token",
      password: "NewPass1",
      confirmPassword: "NewPass1",
    });
    const res = await resetPasswordPOST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("expired");
  });

  it("should return 400 when passwords dont match", async () => {
    const req = createPostRequest("/auth/reset-password", {
      token: "valid-token",
      password: "NewPass1",
      confirmPassword: "Different1",
    });
    const res = await resetPasswordPOST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("match");
  });

  it("should return 400 for weak password", async () => {
    mockValidatePassword.mockReturnValue({
      valid: false,
      error: "Password must contain a number",
    });

    const req = createPostRequest("/auth/reset-password", {
      token: "valid-token",
      password: "weakpass",
      confirmPassword: "weakpass",
    });
    const res = await resetPasswordPOST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("number");
  });

  it("should return 400 for missing token", async () => {
    const req = createPostRequest("/auth/reset-password", {
      password: "NewPass1",
      confirmPassword: "NewPass1",
    });
    const res = await resetPasswordPOST(req);
    expect(res.status).toBe(400);
  });

  it("should handle server errors", async () => {
    mockResetPasswordWithToken.mockRejectedValue(new Error("DB error"));

    const req = createPostRequest("/auth/reset-password", {
      token: "valid-token",
      password: "NewPass1",
      confirmPassword: "NewPass1",
    });
    const res = await resetPasswordPOST(req);
    expect(res.status).toBe(500);
  });
});
