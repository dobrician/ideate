import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSendMail = vi.fn().mockResolvedValue({});

vi.mock("@/db", () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  };
  return { db: mockDb };
});
vi.mock("@/db/schema", () => ({
  users: { id: "id", email: "email", firstName: "first_name", role: "role" },
}));
vi.mock("@/lib/admin-notification-prefs", () => ({
  shouldDeliverAdminAlert: vi.fn(),
}));
vi.mock("@/lib/mail", () => ({
  getSmtpTransporter: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

import { db } from "@/db";
import { shouldDeliverAdminAlert } from "@/lib/admin-notification-prefs";
import { getSmtpTransporter } from "@/lib/mail";
import { deliverAdminAlert, getAlertActionUrl } from "@/lib/admin-alert-delivery";

describe("admin-alert-delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.APP_URL;
    delete process.env.MAIL_LOG_FILE;
  });

  function mockAdmins(admins: Array<{ id: string; email: string; firstName: string | null }>) {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(admins),
      }),
    } as never);
  }

  describe("deliverAdminAlert", () => {
    it("delivers to admin with all channels enabled", async () => {
      mockAdmins([{ id: "u1", email: "admin@test.com", firstName: "Admin" }]);
      vi.mocked(shouldDeliverAdminAlert).mockResolvedValue(true);
      vi.mocked(getSmtpTransporter).mockReturnValue({ sendMail: mockSendMail } as never);

      const result = await deliverAdminAlert({
        category: "ci_alerts",
        title: "Build Failure",
        message: "3 consecutive failures",
        severity: "critical",
      });

      expect(result.inApp).toBe(1);
      expect(result.email).toBe(1);
      expect(result.skipped).toBe(0);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });

    it("skips channels when preference is disabled", async () => {
      mockAdmins([{ id: "u1", email: "admin@test.com", firstName: "Admin" }]);
      vi.mocked(shouldDeliverAdminAlert).mockImplementation(
        async (_userId, _category, channel) => channel === "in_app"
      );
      vi.mocked(getSmtpTransporter).mockReturnValue({ sendMail: mockSendMail } as never);

      const result = await deliverAdminAlert({
        category: "ci_alerts",
        title: "Test",
        message: "Test message",
      });

      expect(result.inApp).toBe(1);
      expect(result.email).toBe(0);
      expect(result.skipped).toBe(1);
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("returns zeros when no admin users", async () => {
      mockAdmins([]);

      const result = await deliverAdminAlert({
        category: "search_quality",
        title: "Test",
        message: "Test",
      });

      expect(result.inApp).toBe(0);
      expect(result.email).toBe(0);
    });

    it("delivers to multiple admins", async () => {
      mockAdmins([
        { id: "u1", email: "admin1@test.com", firstName: "Alice" },
        { id: "u2", email: "admin2@test.com", firstName: "Bob" },
      ]);
      vi.mocked(shouldDeliverAdminAlert).mockResolvedValue(true);
      vi.mocked(getSmtpTransporter).mockReturnValue({ sendMail: mockSendMail } as never);

      const result = await deliverAdminAlert({
        category: "embedding_alerts",
        title: "Quality Drop",
        message: "Embedding quality declined",
        severity: "warning",
      });

      expect(result.inApp).toBe(2);
      expect(result.email).toBe(2);
      expect(mockSendMail).toHaveBeenCalledTimes(2);
    });

    it("continues delivery when one channel fails", async () => {
      mockAdmins([{ id: "u1", email: "admin@test.com", firstName: null }]);
      vi.mocked(shouldDeliverAdminAlert).mockResolvedValue(true);
      vi.mocked(getSmtpTransporter).mockReturnValue({
        sendMail: vi.fn().mockRejectedValue(new Error("SMTP error")),
      } as never);

      const result = await deliverAdminAlert({
        category: "system_events",
        title: "System Alert",
        message: "Something happened",
      });

      expect(result.inApp).toBe(1);
      expect(result.email).toBe(0);
      expect(result.errors).toBe(1);
    });

    it("logs to mail log when SMTP not configured", async () => {
      mockAdmins([{ id: "u1", email: "admin@test.com", firstName: "Admin" }]);
      vi.mocked(shouldDeliverAdminAlert).mockResolvedValue(true);
      vi.mocked(getSmtpTransporter).mockReturnValue(null);
      process.env.MAIL_LOG_FILE = "/tmp/test-mail.log";

      const result = await deliverAdminAlert({
        category: "ci_alerts",
        title: "Test",
        message: "Test",
      });

      expect(result.inApp).toBe(1);
      expect(result.email).toBe(1);
    });

    it("includes action URL in email", async () => {
      mockAdmins([{ id: "u1", email: "admin@test.com", firstName: "Admin" }]);
      vi.mocked(shouldDeliverAdminAlert).mockResolvedValue(true);
      vi.mocked(getSmtpTransporter).mockReturnValue({ sendMail: mockSendMail } as never);

      await deliverAdminAlert({
        category: "ci_alerts",
        title: "CI Alert",
        message: "Builds are slow",
        actionUrl: "http://localhost:3000/admin/perf-dashboard",
      });

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailArgs = mockSendMail.mock.calls[0][0];
      expect(mailArgs.html).toContain("View Details");
      expect(mailArgs.text).toContain("http://localhost:3000/admin/perf-dashboard");
    });
  });

  describe("getAlertActionUrl", () => {
    it("returns correct URLs for each category", () => {
      expect(getAlertActionUrl("ci_alerts")).toContain("/admin/perf-dashboard");
      expect(getAlertActionUrl("search_quality")).toContain("/admin");
      expect(getAlertActionUrl("embedding_alerts")).toContain("/admin/embeddings");
      expect(getAlertActionUrl("system_events")).toContain("/admin");
    });
  });
});
