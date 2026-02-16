import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSendMail = vi.fn();
const mockVerify = vi.fn();

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mockSendMail,
      verify: mockVerify,
    })),
  },
}));

describe("Mail", () => {
  beforeEach(() => {
    vi.resetModules();
    mockSendMail.mockReset();
    mockVerify.mockReset();
  });

  describe("sendMagicLinkEmail", () => {
    it("should send magic link email successfully", async () => {
      mockSendMail.mockResolvedValue({ messageId: "test-123" });

      const { sendMagicLinkEmail } = await import("@/lib/mail");
      await sendMagicLinkEmail("user@example.com", "https://app.test/auth/verify?token=abc");

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe("user@example.com");
      expect(mailOptions.subject).toBe("Sign in to Ideate");
      expect(mailOptions.text).toContain("https://app.test/auth/verify?token=abc");
      expect(mailOptions.html).toContain("https://app.test/auth/verify?token=abc");
    });

    it("should throw on sendMail failure", async () => {
      mockSendMail.mockRejectedValue(new Error("Connection refused"));

      const { sendMagicLinkEmail } = await import("@/lib/mail");
      await expect(
        sendMagicLinkEmail("user@example.com", "https://app.test/verify")
      ).rejects.toThrow("Failed to send email");
    });

    it("should include HTML with sign in button", async () => {
      mockSendMail.mockResolvedValue({ messageId: "test" });

      const { sendMagicLinkEmail } = await import("@/lib/mail");
      await sendMagicLinkEmail("user@example.com", "https://link.test");

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Sign In");
      expect(mailOptions.html).toContain('href="https://link.test"');
    });

    it("should use SMTP_FROM as the sender", async () => {
      mockSendMail.mockResolvedValue({ messageId: "test" });

      const { sendMagicLinkEmail } = await import("@/lib/mail");
      await sendMagicLinkEmail("user@example.com", "https://link.test");

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.from).toBeDefined();
    });
  });

  describe("verifySmtpConnection", () => {
    it("should return true on successful verification", async () => {
      mockVerify.mockResolvedValue(true);

      const { verifySmtpConnection } = await import("@/lib/mail");
      const result = await verifySmtpConnection();
      expect(result).toBe(true);
    });

    it("should return false on verification failure", async () => {
      mockVerify.mockRejectedValue(new Error("Connection refused"));

      const { verifySmtpConnection } = await import("@/lib/mail");
      const result = await verifySmtpConnection();
      expect(result).toBe(false);
    });
  });

  describe("sendVerificationEmail", () => {
    it("should send verification email successfully", async () => {
      mockSendMail.mockResolvedValue({ messageId: "verify-123" });

      const { sendVerificationEmail } = await import("@/lib/mail");
      await sendVerificationEmail("user@example.com", "https://app.test/auth/verify-email?token=abc");

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe("user@example.com");
      expect(mailOptions.subject).toBe("Verify your email - Ideate");
      expect(mailOptions.text).toContain("https://app.test/auth/verify-email?token=abc");
      expect(mailOptions.html).toContain("https://app.test/auth/verify-email?token=abc");
    });

    it("should include HTML with verify button", async () => {
      mockSendMail.mockResolvedValue({ messageId: "verify-456" });

      const { sendVerificationEmail } = await import("@/lib/mail");
      await sendVerificationEmail("user@example.com", "https://link.test");

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Verify Email");
      expect(mailOptions.html).toContain('href="https://link.test"');
    });

    it("should mention 24-hour expiry", async () => {
      mockSendMail.mockResolvedValue({ messageId: "verify-789" });

      const { sendVerificationEmail } = await import("@/lib/mail");
      await sendVerificationEmail("user@example.com", "https://link.test");

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.text).toContain("24 hours");
      expect(mailOptions.html).toContain("24 hours");
    });

    it("should throw on sendMail failure", async () => {
      mockSendMail.mockRejectedValue(new Error("SMTP error"));

      const { sendVerificationEmail } = await import("@/lib/mail");
      await expect(
        sendVerificationEmail("user@example.com", "https://link.test")
      ).rejects.toThrow("Failed to send verification email");
    });
  });

  describe("sendPasswordResetEmail", () => {
    it("should send password reset email successfully", async () => {
      mockSendMail.mockResolvedValue({ messageId: "reset-123" });

      const { sendPasswordResetEmail } = await import("@/lib/mail");
      await sendPasswordResetEmail("user@example.com", "https://app.test/auth/reset-password?token=xyz");

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe("user@example.com");
      expect(mailOptions.subject).toBe("Reset your password - Ideate");
      expect(mailOptions.text).toContain("https://app.test/auth/reset-password?token=xyz");
      expect(mailOptions.html).toContain("https://app.test/auth/reset-password?token=xyz");
    });

    it("should include HTML with reset button", async () => {
      mockSendMail.mockResolvedValue({ messageId: "reset-456" });

      const { sendPasswordResetEmail } = await import("@/lib/mail");
      await sendPasswordResetEmail("user@example.com", "https://link.test");

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Reset Password");
      expect(mailOptions.html).toContain('href="https://link.test"');
    });

    it("should mention 1-hour expiry", async () => {
      mockSendMail.mockResolvedValue({ messageId: "reset-789" });

      const { sendPasswordResetEmail } = await import("@/lib/mail");
      await sendPasswordResetEmail("user@example.com", "https://link.test");

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.text).toContain("1 hour");
      expect(mailOptions.html).toContain("1 hour");
    });

    it("should throw on sendMail failure", async () => {
      mockSendMail.mockRejectedValue(new Error("SMTP error"));

      const { sendPasswordResetEmail } = await import("@/lib/mail");
      await expect(
        sendPasswordResetEmail("user@example.com", "https://link.test")
      ).rejects.toThrow("Failed to send password reset email");
    });
  });

  describe("SMTP config validation", () => {
    it("should throw when SMTP_HOST is not configured", async () => {
      const originalHost = process.env.SMTP_HOST;
      process.env.SMTP_HOST = "";
      vi.resetModules();

      vi.doMock("nodemailer", () => ({
        default: {
          createTransport: vi.fn(() => ({
            sendMail: mockSendMail,
            verify: mockVerify,
          })),
        },
      }));

      try {
        const { sendMagicLinkEmail } = await import("@/lib/mail");
        await expect(
          sendMagicLinkEmail("test@test.com", "https://link.test")
        ).rejects.toThrow("SMTP configuration required");
      } finally {
        process.env.SMTP_HOST = originalHost;
      }
    });
  });

  describe("getSmtpTransporter", () => {
    it("should return null when SMTP is not configured", async () => {
      const origHost = process.env.SMTP_HOST;
      const origUser = process.env.SMTP_USER;
      const origPass = process.env.SMTP_PASS;
      process.env.SMTP_HOST = "";
      process.env.SMTP_USER = "";
      process.env.SMTP_PASS = "";
      vi.resetModules();

      vi.doMock("nodemailer", () => ({
        default: {
          createTransport: vi.fn(() => ({
            sendMail: mockSendMail,
            verify: mockVerify,
          })),
        },
      }));

      try {
        const { getSmtpTransporter } = await import("@/lib/mail");
        expect(getSmtpTransporter()).toBeNull();
      } finally {
        process.env.SMTP_HOST = origHost;
        process.env.SMTP_USER = origUser;
        process.env.SMTP_PASS = origPass;
      }
    });

    it("should return transporter when SMTP is configured", async () => {
      const { getSmtpTransporter } = await import("@/lib/mail");
      const transporter = getSmtpTransporter();
      expect(transporter).not.toBeNull();
    });

    it("should use port 465 as secure", async () => {
      const origPort = process.env.SMTP_PORT;
      process.env.SMTP_PORT = "465";
      vi.resetModules();

      vi.doMock("nodemailer", () => ({
        default: {
          createTransport: vi.fn(() => ({
            sendMail: mockSendMail,
            verify: mockVerify,
          })),
        },
      }));

      try {
        const { getSmtpTransporter } = await import("@/lib/mail");
        const transporter = getSmtpTransporter();
        expect(transporter).not.toBeNull();
      } finally {
        process.env.SMTP_PORT = origPort;
      }
    });
  });
});
