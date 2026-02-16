import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the deliverability module
const mockCheckDeliverability = vi.fn();

vi.mock("@/lib/email-deliverability", () => ({
  checkDeliverability: (...args: unknown[]) => mockCheckDeliverability(...args),
}));

// Import after mocks
import { GET } from "@/app/api/email/deliverability/route";

beforeEach(() => {
  mockCheckDeliverability.mockReset();
});

describe("Email Deliverability API Route", () => {
  describe("GET /api/email/deliverability", () => {
    it("should return a deliverability report", async () => {
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
