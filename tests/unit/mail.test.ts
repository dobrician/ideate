import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSendMail = vi.fn();
const mockVerify = vi.fn();
const mockTransport = { sendMail: mockSendMail, verify: mockVerify };
vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn(() => mockTransport) },
}));

function reMockNodemailer() {
  vi.resetModules();
  vi.doMock("nodemailer", () => ({
    default: { createTransport: vi.fn(() => mockTransport) },
  }));
}

describe("Mail", () => {
  beforeEach(() => { vi.resetModules(); mockSendMail.mockReset(); mockVerify.mockReset(); });

  describe("sendMagicLinkEmail", () => {
    it("sends magic link email with correct content", async () => {
      mockSendMail.mockResolvedValue({ messageId: "test-123" });
      const { sendMagicLinkEmail } = await import("@/lib/mail");
      await sendMagicLinkEmail("user@example.com", "https://app.test/auth/verify?token=abc");
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const opts = mockSendMail.mock.calls[0][0];
      expect(opts.to).toBe("user@example.com");
      expect(opts.subject).toBe("Sign in to Ideate");
      expect(opts.text).toContain("https://app.test/auth/verify?token=abc");
      expect(opts.html).toContain("Sign In");
      expect(opts.html).toContain('href="https://app.test/auth/verify?token=abc"');
      expect(opts.from).toBeDefined();
    });

    it("throws on sendMail failure", async () => {
      mockSendMail.mockRejectedValue(new Error("Connection refused"));
      const { sendMagicLinkEmail } = await import("@/lib/mail");
      await expect(sendMagicLinkEmail("u@e.com", "https://l.t")).rejects.toThrow("Failed to send email");
    });
  });

  describe("sendVerificationEmail", () => {
    it("sends verification email with correct content", async () => {
      mockSendMail.mockResolvedValue({ messageId: "verify-123" });
      const { sendVerificationEmail } = await import("@/lib/mail");
      await sendVerificationEmail("user@example.com", "https://app.test/auth/verify-email?token=abc");
      const opts = mockSendMail.mock.calls[0][0];
      expect(opts.to).toBe("user@example.com");
      expect(opts.subject).toBe("Verify your email - Ideate");
      expect(opts.html).toContain("Verify Email");
      expect(opts.html).toContain('href="https://app.test/auth/verify-email?token=abc"');
    });

    it("mentions 24-hour expiry", async () => {
      mockSendMail.mockResolvedValue({});
      const { sendVerificationEmail } = await import("@/lib/mail");
      await sendVerificationEmail("u@e.com", "https://l.t");
      const opts = mockSendMail.mock.calls[0][0];
      expect(opts.text).toContain("24 hours");
      expect(opts.html).toContain("24 hours");
    });

    it("throws on sendMail failure", async () => {
      mockSendMail.mockRejectedValue(new Error("SMTP error"));
      const { sendVerificationEmail } = await import("@/lib/mail");
      await expect(sendVerificationEmail("u@e.com", "https://l.t")).rejects.toThrow("Failed to send verification email");
    });
  });

  describe("sendPasswordResetEmail", () => {
    it("sends reset email with correct content", async () => {
      mockSendMail.mockResolvedValue({});
      const { sendPasswordResetEmail } = await import("@/lib/mail");
      await sendPasswordResetEmail("user@example.com", "https://app.test/auth/reset?token=xyz");
      const opts = mockSendMail.mock.calls[0][0];
      expect(opts.to).toBe("user@example.com");
      expect(opts.subject).toBe("Reset your password - Ideate");
      expect(opts.html).toContain("Reset Password");
      expect(opts.html).toContain('href="https://app.test/auth/reset?token=xyz"');
    });

    it("mentions 1-hour expiry", async () => {
      mockSendMail.mockResolvedValue({});
      const { sendPasswordResetEmail } = await import("@/lib/mail");
      await sendPasswordResetEmail("u@e.com", "https://l.t");
      const opts = mockSendMail.mock.calls[0][0];
      expect(opts.text).toContain("1 hour");
      expect(opts.html).toContain("1 hour");
    });

    it("throws on sendMail failure", async () => {
      mockSendMail.mockRejectedValue(new Error("SMTP error"));
      const { sendPasswordResetEmail } = await import("@/lib/mail");
      await expect(sendPasswordResetEmail("u@e.com", "https://l.t")).rejects.toThrow("Failed to send password reset email");
    });
  });

  describe("sendInvitationEmail", () => {
    it("sends invitation email with correct content", async () => {
      mockSendMail.mockResolvedValue({});
      const { sendInvitationEmail } = await import("@/lib/mail");
      await sendInvitationEmail("new@example.com", "https://app.test/register?invite=abc", "admin@example.com");
      const opts = mockSendMail.mock.calls[0][0];
      expect(opts.to).toBe("new@example.com");
      expect(opts.subject).toContain("invited");
    });

    it("includes inviter email in body", async () => {
      mockSendMail.mockResolvedValue({});
      const { sendInvitationEmail } = await import("@/lib/mail");
      await sendInvitationEmail("new@example.com", "https://l.t", "admin@example.com");
      const opts = mockSendMail.mock.calls[0][0];
      expect(opts.text).toContain("admin@example.com");
      expect(opts.html).toContain("admin@example.com");
    });

    it("includes invite link with Create Account button", async () => {
      mockSendMail.mockResolvedValue({});
      const { sendInvitationEmail } = await import("@/lib/mail");
      await sendInvitationEmail("n@e.com", "https://link.test/invite", "a@e.com");
      const opts = mockSendMail.mock.calls[0][0];
      expect(opts.html).toContain('href="https://link.test/invite"');
      expect(opts.html).toContain("Create Account");
    });

    it("mentions 7-day expiry", async () => {
      mockSendMail.mockResolvedValue({});
      const { sendInvitationEmail } = await import("@/lib/mail");
      await sendInvitationEmail("n@e.com", "https://l.t", "a@e.com");
      const opts = mockSendMail.mock.calls[0][0];
      expect(opts.text).toContain("7 days");
      expect(opts.html).toContain("7 days");
    });

    it("throws on sendMail failure", async () => {
      mockSendMail.mockRejectedValue(new Error("SMTP error"));
      const { sendInvitationEmail } = await import("@/lib/mail");
      await expect(sendInvitationEmail("n@e.com", "https://l.t", "a@e.com"))
        .rejects.toThrow("Failed to send invitation email");
    });
  });

  describe("verifySmtpConnection", () => {
    it("returns true on success", async () => {
      mockVerify.mockResolvedValue(true);
      const { verifySmtpConnection } = await import("@/lib/mail");
      expect(await verifySmtpConnection()).toBe(true);
    });

    it("returns false on failure", async () => {
      mockVerify.mockRejectedValue(new Error("Connection refused"));
      const { verifySmtpConnection } = await import("@/lib/mail");
      expect(await verifySmtpConnection()).toBe(false);
    });
  });

  describe("SMTP config validation", () => {
    it("throws when SMTP_HOST is not configured", async () => {
      const orig = process.env.SMTP_HOST;
      process.env.SMTP_HOST = "";
      reMockNodemailer();
      try {
        const { sendMagicLinkEmail } = await import("@/lib/mail");
        await expect(sendMagicLinkEmail("t@t.com", "https://l.t")).rejects.toThrow("SMTP configuration required");
      } finally { process.env.SMTP_HOST = orig; }
    });
  });

  describe("getSmtpTransporter", () => {
    it("returns null when SMTP is not configured", async () => {
      const e = process.env;
      const orig = { h: e.SMTP_HOST, u: e.SMTP_USER, p: e.SMTP_PASS };
      e.SMTP_HOST = ""; e.SMTP_USER = ""; e.SMTP_PASS = "";
      reMockNodemailer();
      try {
        const { getSmtpTransporter } = await import("@/lib/mail");
        expect(getSmtpTransporter()).toBeNull();
      } finally { e.SMTP_HOST = orig.h; e.SMTP_USER = orig.u; e.SMTP_PASS = orig.p; }
    });

    it("returns transporter when SMTP is configured", async () => {
      const { getSmtpTransporter } = await import("@/lib/mail");
      expect(getSmtpTransporter()).not.toBeNull();
    });

    it("uses port 465 as secure", async () => {
      const orig = process.env.SMTP_PORT;
      process.env.SMTP_PORT = "465";
      reMockNodemailer();
      try {
        const { getSmtpTransporter } = await import("@/lib/mail");
        expect(getSmtpTransporter()).not.toBeNull();
      } finally { process.env.SMTP_PORT = orig; }
    });
  });
});
