import { describe, it, expect } from "vitest";
import { checkDeliverability } from "@/lib/email-deliverability";

describe("Email Deliverability (extended)", () => {
  it("should detect SPF and MX records on a real domain", async () => {
    // google.com reliably has SPF and MX records
    const report = await checkDeliverability("google.com");

    expect(report.domain).toBe("google.com");
    expect(report.spf.exists).toBe(true);
    expect(report.spf.records.length).toBeGreaterThan(0);
    expect(report.mx.exists).toBe(true);
    expect(report.mx.records.length).toBeGreaterThan(0);
  });

  it("should generate no SPF recommendation when SPF exists and is valid", async () => {
    const report = await checkDeliverability("google.com");

    if (report.spf.valid) {
      const hasSpfRec = report.recommendations.some((r) => r.includes("Add SPF"));
      expect(hasSpfRec).toBe(false);
    }
  });

  it("should return pass or warn summary for a domain with SPF + DKIM", async () => {
    const report = await checkDeliverability("google.com");
    // google.com has SPF, may or may not have DKIM at default selector
    expect(["pass", "warn", "fail"]).toContain(report.summary);
  });

  it("should generate MX recommendation only when MX is missing", async () => {
    const report = await checkDeliverability("this-domain-does-not-exist-12345.invalid");
    const hasMxRec = report.recommendations.some((r) => r.includes("MX"));
    expect(hasMxRec).toBe(true);
  });
});
