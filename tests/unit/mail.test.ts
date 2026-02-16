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
});
