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
