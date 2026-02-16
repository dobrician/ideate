import { describe, it, expect } from "vitest";

/**
 * Email deliverability tests.
 * Note: checkDeliverability makes real DNS calls via promisify(resolve).
 * We test the module's type exports and behavior contract here.
 * Full integration testing requires actual DNS resolution.
 */
describe("Email Deliverability", () => {
  it("should export checkDeliverability function", async () => {
    const mod = await import("@/lib/email-deliverability");
    expect(typeof mod.checkDeliverability).toBe("function");
  });

  it("checkDeliverability should return a report for a non-existent domain", async () => {
    const { checkDeliverability } = await import("@/lib/email-deliverability");
    // Use a domain that definitely has no DNS records
    const report = await checkDeliverability("this-domain-does-not-exist-12345.invalid");

    expect(report.domain).toBe("this-domain-does-not-exist-12345.invalid");
    expect(report.spf).toBeDefined();
    expect(report.spf.exists).toBe(false);
    expect(report.dkim).toBeDefined();
    expect(report.dkim.exists).toBe(false);
    expect(report.mx).toBeDefined();
    expect(report.mx.exists).toBe(false);
    expect(report.summary).toBe("fail");
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it("checkDeliverability should use custom DKIM selector", async () => {
    const { checkDeliverability } = await import("@/lib/email-deliverability");
    const report = await checkDeliverability("this-domain-does-not-exist-12345.invalid", "custom");

    expect(report.dkim.selector).toBe("custom");
  });

  it("checkDeliverability should default to 'default' DKIM selector", async () => {
    const { checkDeliverability } = await import("@/lib/email-deliverability");
    const report = await checkDeliverability("this-domain-does-not-exist-12345.invalid");

    expect(report.dkim.selector).toBe("default");
  });

  it("should include recommendations for missing SPF", async () => {
    const { checkDeliverability } = await import("@/lib/email-deliverability");
    const report = await checkDeliverability("this-domain-does-not-exist-12345.invalid");

    const hasSpfRec = report.recommendations.some((r) => r.includes("SPF"));
    expect(hasSpfRec).toBe(true);
  });

  it("should include recommendations for missing DKIM", async () => {
    const { checkDeliverability } = await import("@/lib/email-deliverability");
    const report = await checkDeliverability("this-domain-does-not-exist-12345.invalid");

    const hasDkimRec = report.recommendations.some((r) => r.includes("DKIM"));
    expect(hasDkimRec).toBe(true);
  });
});
