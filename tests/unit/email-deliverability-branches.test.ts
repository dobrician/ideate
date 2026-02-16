import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the dns module to control DNS responses
vi.mock("dns", () => {
  const mockResolve = vi.fn();
  return {
    resolve: mockResolve,
  };
});

describe("Email Deliverability (branch coverage)", () => {
  let checkDeliverability: typeof import("@/lib/email-deliverability").checkDeliverability;
  let mockResolve: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    const dns = await import("dns");
    mockResolve = dns.resolve as ReturnType<typeof vi.fn>;

    const mod = await import("@/lib/email-deliverability");
    checkDeliverability = mod.checkDeliverability;
  });

  it("should return pass when SPF is valid, DKIM exists, and MX exists", async () => {
    mockResolve.mockImplementation(
      (hostname: string, rrtype: string, callback: Function) => {
        if (rrtype === "TXT" && !hostname.includes("_domainkey")) {
          callback(null, [["v=spf1 include:example.com ~all"]]);
        } else if (rrtype === "TXT" && hostname.includes("_domainkey")) {
          callback(null, [["v=DKIM1; k=rsa; p=abc123"]]);
        } else if (rrtype === "MX") {
          callback(null, [{ exchange: "mail.example.com", priority: 10 }]);
        } else {
          callback(new Error("unknown rrtype"));
        }
      }
    );

    const report = await checkDeliverability("example.com");
    expect(report.summary).toBe("pass");
    expect(report.spf.exists).toBe(true);
    expect(report.spf.valid).toBe(true);
    expect(report.dkim.exists).toBe(true);
    expect(report.mx.exists).toBe(true);
    expect(report.recommendations).toHaveLength(0);
  });

  it("should return warn when SPF exists with multiple records (invalid) and DKIM exists", async () => {
    mockResolve.mockImplementation(
      (hostname: string, rrtype: string, callback: Function) => {
        if (rrtype === "TXT" && !hostname.includes("_domainkey")) {
          // Multiple SPF records — exists but invalid
          callback(null, [
            ["v=spf1 include:a.com ~all"],
            ["v=spf1 include:b.com ~all"],
          ]);
        } else if (rrtype === "TXT" && hostname.includes("_domainkey")) {
          callback(null, [["v=DKIM1; k=rsa; p=abc123"]]);
        } else if (rrtype === "MX") {
          callback(null, [{ exchange: "mail.example.com", priority: 10 }]);
        }
      }
    );

    const report = await checkDeliverability("example.com");
    expect(report.spf.exists).toBe(true);
    expect(report.spf.valid).toBe(false);
    expect(report.summary).toBe("warn");
    expect(report.recommendations).toContainEqual(
      expect.stringContaining("Merge into a single record")
    );
  });

  it("should return warn when SPF valid + DKIM exists but MX missing", async () => {
    mockResolve.mockImplementation(
      (hostname: string, rrtype: string, callback: Function) => {
        if (rrtype === "TXT" && !hostname.includes("_domainkey")) {
          callback(null, [["v=spf1 include:example.com ~all"]]);
        } else if (rrtype === "TXT" && hostname.includes("_domainkey")) {
          callback(null, [["v=DKIM1; k=rsa; p=abc123"]]);
        } else if (rrtype === "MX") {
          callback(null, []);
        }
      }
    );

    const report = await checkDeliverability("example.com");
    expect(report.summary).toBe("warn");
    expect(report.mx.exists).toBe(false);
    expect(report.recommendations).toContainEqual(
      expect.stringContaining("MX record")
    );
  });

  it("should return fail when SPF missing regardless of other records", async () => {
    mockResolve.mockImplementation(
      (hostname: string, rrtype: string, callback: Function) => {
        if (rrtype === "TXT" && !hostname.includes("_domainkey")) {
          // No SPF records
          callback(null, [["some-other-txt-record"]]);
        } else if (rrtype === "TXT" && hostname.includes("_domainkey")) {
          callback(null, [["v=DKIM1; k=rsa; p=abc123"]]);
        } else if (rrtype === "MX") {
          callback(null, [{ exchange: "mail.example.com", priority: 10 }]);
        }
      }
    );

    const report = await checkDeliverability("example.com");
    expect(report.summary).toBe("fail");
    expect(report.spf.exists).toBe(false);
  });

  it("should return fail when DKIM missing regardless of other records", async () => {
    mockResolve.mockImplementation(
      (hostname: string, rrtype: string, callback: Function) => {
        if (rrtype === "TXT" && !hostname.includes("_domainkey")) {
          callback(null, [["v=spf1 include:example.com ~all"]]);
        } else if (rrtype === "TXT" && hostname.includes("_domainkey")) {
          // DKIM record without v=DKIM1
          callback(null, [["not-a-dkim-record"]]);
        } else if (rrtype === "MX") {
          callback(null, [{ exchange: "mail.example.com", priority: 10 }]);
        }
      }
    );

    const report = await checkDeliverability("example.com");
    expect(report.summary).toBe("fail");
    expect(report.dkim.exists).toBe(false);
    expect(report.recommendations).toContainEqual(
      expect.stringContaining("DKIM")
    );
  });

  it("should handle DNS errors gracefully for all record types", async () => {
    mockResolve.mockImplementation(
      (_hostname: string, _rrtype: string, callback: Function) => {
        callback(new Error("DNS timeout"));
      }
    );

    const report = await checkDeliverability("example.com");
    expect(report.spf.exists).toBe(false);
    expect(report.dkim.exists).toBe(false);
    expect(report.mx.exists).toBe(false);
    expect(report.summary).toBe("fail");
  });

  it("should use custom DKIM selector in DNS lookup", async () => {
    const queriedHostnames: string[] = [];
    mockResolve.mockImplementation(
      (hostname: string, rrtype: string, callback: Function) => {
        queriedHostnames.push(hostname);
        if (rrtype === "TXT") {
          callback(null, []);
        } else {
          callback(null, []);
        }
      }
    );

    await checkDeliverability("example.com", "s1");
    expect(queriedHostnames).toContainEqual("s1._domainkey.example.com");
  });

  it("should include DKIM public key recommendation when DKIM missing", async () => {
    mockResolve.mockImplementation(
      (_hostname: string, _rrtype: string, callback: Function) => {
        callback(new Error("NXDOMAIN"));
      }
    );

    const report = await checkDeliverability("example.com");
    expect(report.recommendations).toContainEqual(
      expect.stringContaining("DKIM public key")
    );
  });
});
