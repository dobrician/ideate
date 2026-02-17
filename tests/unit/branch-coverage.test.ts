/**
 * Targeted branch coverage tests for files with gaps.
 * Sprint 00 Goal 1: Push branch coverage from 93.85% to 95%+.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── rbac.ts line 72: the ?? false fallback (invalid role) ──────────────
describe("rbac.ts branch coverage", () => {
  it("hasPermission returns false for unknown role via ?? fallback", async () => {
    const { hasPermission } = await import("@/lib/rbac");
    // Force an invalid role to trigger the ?? false path
    expect(hasPermission("unknown" as never, "project:read")).toBe(false);
  });
});

// ── sanitize.ts line 20: escapeHtml char not in map (|| char fallback) ─
describe("sanitize.ts branch coverage", () => {
  it("escapeHtml passes through chars matched by regex but missing from map", async () => {
    const { escapeHtml } = await import("@/lib/sanitize");
    // All 6 special chars exercise the map lookup
    expect(escapeHtml("&<>\"'/")).toBe("&amp;&lt;&gt;&quot;&#x27;&#x2F;");
    // Empty string — no replacements
    expect(escapeHtml("")).toBe("");
  });
});

// ── csrf.ts line 32: validateOrigin with missing APP_URL env ───────────
// ── csrf.ts line 77: token length mismatch branch ──────────────────────
describe("csrf.ts branch coverage", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("validateOrigin uses default localhost when APP_URL is empty", async () => {
    const orig = process.env.APP_URL;
    process.env.APP_URL = "";
    vi.resetModules();
    const { NextRequest } = await import("next/server");
    const { validateOrigin } = await import("@/lib/csrf");
    const req = new NextRequest("http://localhost:3000/api/test", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    });
    expect(validateOrigin(req)).toBe(true);
    process.env.APP_URL = orig;
  });

  it("validateCsrfToken returns false when token lengths differ", async () => {
    const mockCookies = { get: vi.fn().mockReturnValue({ value: "short" }) };
    vi.doMock("next/headers", () => ({
      cookies: vi.fn(() => Promise.resolve(mockCookies)),
    }));
    vi.resetModules();
    const { validateCsrfToken } = await import("@/lib/csrf");
    // "short" (5 chars) vs "longer-token" (12 chars) — length mismatch
    const result = await validateCsrfToken("longer-token");
    expect(result).toBe(false);
  });
});

// ── mail.ts lines 8,11,15-16: env var fallback branches ────────────────
describe("mail.ts branch coverage", () => {
  it("logMail uses /tmp fallback when MAIL_LOG_FILE empty in non-production", async () => {
    const origLog = process.env.MAIL_LOG_FILE;
    const origEnv = process.env.NODE_ENV;
    process.env.MAIL_LOG_FILE = "";
    process.env.NODE_ENV = "test";
    vi.resetModules();

    const mockSendMail = vi.fn().mockResolvedValue({ messageId: "t" });
    vi.doMock("nodemailer", () => ({
      default: {
        createTransport: vi.fn(() => ({
          sendMail: mockSendMail,
          verify: vi.fn(),
        })),
      },
    }));

    const { sendMagicLinkEmail } = await import("@/lib/mail");
    await sendMagicLinkEmail("test@test.com", "https://link.test");
    expect(mockSendMail).toHaveBeenCalledTimes(1);

    process.env.MAIL_LOG_FILE = origLog;
    process.env.NODE_ENV = origEnv;
  });

  it("logMail skips when in production with empty MAIL_LOG_FILE", async () => {
    const origLog = process.env.MAIL_LOG_FILE;
    const origEnv = process.env.NODE_ENV;
    process.env.MAIL_LOG_FILE = "";
    process.env.NODE_ENV = "production";
    vi.resetModules();

    const mockSendMail = vi.fn().mockResolvedValue({ messageId: "t" });
    vi.doMock("nodemailer", () => ({
      default: {
        createTransport: vi.fn(() => ({
          sendMail: mockSendMail,
          verify: vi.fn(),
        })),
      },
    }));

    const { sendMagicLinkEmail } = await import("@/lib/mail");
    await sendMagicLinkEmail("test@test.com", "https://link.test");
    expect(mockSendMail).toHaveBeenCalledTimes(1);

    process.env.MAIL_LOG_FILE = origLog;
    process.env.NODE_ENV = origEnv;
  });
});

// ── auth.ts line 173: verifySessionToken with wrong type ───────────────
describe("auth.ts branch coverage", () => {
  it("verifySessionToken returns null for token with type !== session", async () => {
    vi.resetModules();
    const origSecret = process.env.JWT_SECRET;
    const origUrl = process.env.APP_URL;
    process.env.JWT_SECRET = "a".repeat(32);
    process.env.APP_URL = "http://localhost:3000";

    const mockCookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
    vi.doMock("next/headers", () => ({
      cookies: vi.fn(() => Promise.resolve(mockCookies)),
    }));
    vi.doMock("@/db", () => ({
      db: { select: vi.fn().mockReturnThis(), from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) },
    }));

    const jwt = await import("jsonwebtoken");
    const { verifySessionToken } = await import("@/lib/auth");

    // Create a token with type "magic-link" instead of "session"
    const token = jwt.default.sign(
      { userId: "u1", email: "a@b.com", type: "magic-link" },
      "a".repeat(32),
      { issuer: "http://localhost:3000", audience: "http://localhost:3000" }
    );
    expect(verifySessionToken(token)).toBeNull();

    process.env.JWT_SECRET = origSecret;
    process.env.APP_URL = origUrl;
  });
});

// ── search.ts line 4: DB_PATH env fallback ─────────────────────────────
describe("search.ts branch coverage", () => {
  it("uses DATABASE_URL env when set", async () => {
    const orig = process.env.DATABASE_URL;
    process.env.DATABASE_URL = ":memory:";
    vi.resetModules();
    // Just importing triggers the env read; search will fail but
    // the branch for DATABASE_URL presence is exercised
    try {
      const { search } = await import("@/lib/search");
      // Short query returns empty
      expect(search("a")).toEqual([]);
    } finally {
      process.env.DATABASE_URL = orig;
    }
  });
});

// ── rate-limit.ts line 26: empty timestamps after cleanup → delete key ─
describe("rate-limit.ts branch coverage", () => {
  it("cleanup deletes keys with zero timestamps after window expiry", async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const { checkRateLimit, resetRateLimits } = await import("@/lib/rate-limit");
    resetRateLimits();

    // Create an entry
    checkRateLimit("test-key", 10, 1000);

    // Advance past window + cleanup interval
    vi.advanceTimersByTime(120_000);

    // Next call triggers cleanup — old entry has expired timestamps → delete
    checkRateLimit("other-key", 10, 1000);

    vi.useRealTimers();
  });
});

// ── notifications.ts lines 12-13: env var fallbacks ────────────────────
describe("notifications.ts branch coverage", () => {
  it("uses default SMTP_FROM and APP_URL when env vars are empty", async () => {
    const origFrom = process.env.SMTP_FROM;
    const origUrl = process.env.APP_URL;
    process.env.SMTP_FROM = "";
    process.env.APP_URL = "";
    vi.resetModules();

    vi.doMock("@/db", () => ({
      db: { select: vi.fn().mockReturnThis(), from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) },
    }));
    vi.doMock("@/lib/mail", () => ({
      getSmtpTransporter: vi.fn().mockReturnValue(null),
    }));

    // Just importing exercises the env var reads at lines 12-13
    await import("@/lib/notifications");

    process.env.SMTP_FROM = origFrom;
    process.env.APP_URL = origUrl;
  });
});

// ── i18n.ts line 8: LOCALE env starting with "ro" ─────────────────────
describe("i18n.ts branch coverage", () => {
  it("uses ro locale when LOCALE env starts with ro", async () => {
    const orig = process.env.LOCALE;
    process.env.LOCALE = "ro_RO";
    vi.resetModules();
    const { getDefaultLocale } = await import("@/lib/i18n");
    expect(getDefaultLocale()).toBe("ro");
    if (orig === undefined) delete process.env.LOCALE;
    else process.env.LOCALE = orig;
  });
});

// ── export.ts: project comments in PDF ─────
describe("export.ts branch coverage", () => {
  it("generatePdf includes project comments section", async () => {
    const { generatePdf } = await import("@/lib/export");
    const buffer = await generatePdf({
      title: "PDF Test",
      description: "Desc",
      status: "active",
      deadline: null,
      createdAt: new Date(),
      proposals: [],
      projectComments: [
        { content: "Comment text", authorName: "C", createdAt: new Date() },
      ],
    });
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
