import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), fatal: vi.fn(), debug: vi.fn() },
}));

import { sendViaResend, isResendConfigured } from "@/lib/mail-resend";

describe("mail-resend", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe("isResendConfigured", () => {
    it("returns false when RESEND_API_KEY is not set", () => {
      delete process.env.RESEND_API_KEY;
      expect(isResendConfigured()).toBe(false);
    });

    it("returns true when RESEND_API_KEY is set", () => {
      process.env.RESEND_API_KEY = "re_test_key";
      expect(isResendConfigured()).toBe(true);
    });
  });

  describe("sendViaResend", () => {
    const payload = {
      from: "test@example.com",
      to: "user@example.com",
      subject: "Test",
      text: "Hello",
      html: "<p>Hello</p>",
    };

    it("throws when RESEND_API_KEY is missing", async () => {
      delete process.env.RESEND_API_KEY;
      await expect(sendViaResend(payload)).rejects.toThrow("RESEND_API_KEY is required");
    });

    it("sends email via Resend API", async () => {
      process.env.RESEND_API_KEY = "re_test_key";
      vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 200 }));

      await sendViaResend(payload);

      expect(fetch).toHaveBeenCalledWith("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer re_test_key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    });

    it("throws on non-OK response", async () => {
      process.env.RESEND_API_KEY = "re_test_key";
      vi.mocked(fetch).mockResolvedValue(
        new Response("rate limited", { status: 429 })
      );

      await expect(sendViaResend(payload)).rejects.toThrow("Resend API error (429): rate limited");
    });
  });
});
