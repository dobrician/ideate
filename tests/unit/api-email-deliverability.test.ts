import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the deliverability module
const mockCheckDeliverability = vi.fn();
const mockGetCurrentUser = vi.fn();

vi.mock("@/lib/email-deliverability", () => ({
  checkDeliverability: (...args: unknown[]) => mockCheckDeliverability(...args),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: (role: string, permission: string) => {
    if (permission === "user:manage") return role === "admin";
    return false;
  },
}));

// Import after mocks
import { GET } from "@/app/api/email/deliverability/route";

const adminUser = { id: "admin-1", email: "admin@example.com", role: "admin" };
const memberUser = { id: "user-1", email: "user@example.com", role: "member" };

beforeEach(() => {
  mockCheckDeliverability.mockReset();
  mockGetCurrentUser.mockReset();
  mockGetCurrentUser.mockResolvedValue(adminUser);
});

describe("Email Deliverability API Route", () => {
  describe("GET /api/email/deliverability", () => {
    it("should return 401 when not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 403 when user is not admin", async () => {
      mockGetCurrentUser.mockResolvedValue(memberUser);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });

    it("should return a deliverability report for admin", async () => {
      const mockReport = {
        domain: "surcod.ro",
        spf: { exists: true, records: ["v=spf1"], valid: true },
        dkim: { exists: true, records: ["v=DKIM1"], selector: "default" },
        mx: { exists: true, records: ["10 mail.surcod.ro"] },
        summary: "pass" as const,
        recommendations: [],
      };

      mockCheckDeliverability.mockResolvedValue(mockReport);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.summary).toBe("pass");
      expect(data.spf).toBeDefined();
      expect(data.dkim).toBeDefined();
      expect(data.mx).toBeDefined();
    });

    it("should handle deliverability check errors", async () => {
      mockCheckDeliverability.mockRejectedValue(new Error("DNS timeout"));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to check deliverability");
    });

    it("should return report with fail summary", async () => {
      const failReport = {
        domain: "surcod.ro",
        spf: { exists: false, records: [], valid: false },
        dkim: { exists: false, records: [], selector: "default" },
        mx: { exists: false, records: [] },
        summary: "fail" as const,
        recommendations: ["Add SPF record", "Add DKIM record"],
      };

      mockCheckDeliverability.mockResolvedValue(failReport);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.summary).toBe("fail");
      expect(data.recommendations).toHaveLength(2);
    });

    it("should return report with warn summary", async () => {
      const warnReport = {
        domain: "surcod.ro",
        spf: { exists: true, records: ["v=spf1"], valid: false },
        dkim: { exists: true, records: ["v=DKIM1"], selector: "default" },
        mx: { exists: false, records: [] },
        summary: "warn" as const,
        recommendations: ["Add MX record"],
      };

      mockCheckDeliverability.mockResolvedValue(warnReport);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.summary).toBe("warn");
    });

    it("should return 500 when SMTP_FROM has no domain", async () => {
      const original = process.env.SMTP_FROM;
      process.env.SMTP_FROM = "no-at-sign";
      vi.resetModules();

      // Re-mock after module reset
      vi.doMock("@/lib/email-deliverability", () => ({
        checkDeliverability: mockCheckDeliverability,
      }));
      vi.doMock("@/lib/auth", () => ({
        getCurrentUser: () => Promise.resolve(adminUser),
      }));
      vi.doMock("@/lib/rbac", () => ({
        hasPermission: () => true,
      }));

      const { GET: GET2 } = await import("@/app/api/email/deliverability/route");
      const response = await GET2();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("SMTP_FROM not configured");

      process.env.SMTP_FROM = original;
    });

    it("should use custom SMTP_FROM env var when set", async () => {
      const original = process.env.SMTP_FROM;
      process.env.SMTP_FROM = "noreply@custom.io";
      vi.resetModules();

      vi.doMock("@/lib/email-deliverability", () => ({
        checkDeliverability: (...args: unknown[]) => mockCheckDeliverability(...args),
      }));
      vi.doMock("@/lib/auth", () => ({
        getCurrentUser: () => Promise.resolve(adminUser),
      }));
      vi.doMock("@/lib/rbac", () => ({
        hasPermission: () => true,
      }));

      mockCheckDeliverability.mockResolvedValue({
        domain: "custom.io",
        spf: { exists: true, records: [], valid: true },
        dkim: { exists: true, records: [], selector: "default" },
        mx: { exists: true, records: [] },
        summary: "pass",
        recommendations: [],
      });

      const { GET: GET3 } = await import("@/app/api/email/deliverability/route");
      const response = await GET3();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockCheckDeliverability).toHaveBeenCalledWith("custom.io");
      expect(data.domain).toBe("custom.io");

      process.env.SMTP_FROM = original;
    });

    it("should include domain in response", async () => {
      mockCheckDeliverability.mockResolvedValue({
        domain: "surcod.ro",
        spf: { exists: true, records: [], valid: true },
        dkim: { exists: true, records: [], selector: "default" },
        mx: { exists: true, records: [] },
        summary: "pass",
        recommendations: [],
      });

      const response = await GET();
      const data = await response.json();

      expect(data.domain).toBeDefined();
      expect(typeof data.domain).toBe("string");
    });
  });
});
