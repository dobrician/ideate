import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

describe("request-utils", () => {
  const originalEnv = process.env.TRUSTED_PROXIES;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.TRUSTED_PROXIES;
    } else {
      process.env.TRUSTED_PROXIES = originalEnv;
    }
  });

  describe("getClientIp", () => {
    it("returns 'unknown' when TRUSTED_PROXIES is not set", async () => {
      delete process.env.TRUSTED_PROXIES;
      const { getClientIp } = await import("@/lib/request-utils");
      const req = new Request("http://localhost", {
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
      expect(getClientIp(req)).toBe("unknown");
    });

    it("returns forwarded IP when TRUSTED_PROXIES is '*'", async () => {
      process.env.TRUSTED_PROXIES = "*";
      const { getClientIp } = await import("@/lib/request-utils");
      const req = new Request("http://localhost", {
        headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
      });
      expect(getClientIp(req)).toBe("1.2.3.4");
    });

    it("returns x-real-ip when forwarded-for is absent", async () => {
      process.env.TRUSTED_PROXIES = "10.0.0.1";
      const { getClientIp } = await import("@/lib/request-utils");
      const req = new Request("http://localhost", {
        headers: { "x-real-ip": "9.8.7.6" },
      });
      expect(getClientIp(req)).toBe("9.8.7.6");
    });

    it("returns 'unknown' when trusted but no headers present", async () => {
      process.env.TRUSTED_PROXIES = "*";
      const { getClientIp } = await import("@/lib/request-utils");
      const req = new Request("http://localhost");
      expect(getClientIp(req)).toBe("unknown");
    });
  });

  describe("getActionClientIp", () => {
    it("returns 'unknown' when TRUSTED_PROXIES is not set", async () => {
      delete process.env.TRUSTED_PROXIES;
      const mockGet = vi.fn().mockReturnValue(null);
      const { headers } = await import("next/headers");
      vi.mocked(headers).mockResolvedValue({ get: mockGet } as never);
      const { getActionClientIp } = await import("@/lib/request-utils");
      expect(await getActionClientIp()).toBe("unknown");
    });

    it("returns forwarded IP when TRUSTED_PROXIES is set", async () => {
      process.env.TRUSTED_PROXIES = "*";
      const mockGet = vi.fn().mockImplementation((name: string) => {
        if (name === "x-forwarded-for") return "10.20.30.40, 50.60.70.80";
        return null;
      });
      const { headers } = await import("next/headers");
      vi.mocked(headers).mockResolvedValue({ get: mockGet } as never);
      const { getActionClientIp } = await import("@/lib/request-utils");
      expect(await getActionClientIp()).toBe("10.20.30.40");
    });

    it("returns x-real-ip as fallback when forwarded-for absent", async () => {
      process.env.TRUSTED_PROXIES = "proxy1";
      const mockGet = vi.fn().mockImplementation((name: string) => {
        if (name === "x-real-ip") return "11.22.33.44";
        return null;
      });
      const { headers } = await import("next/headers");
      vi.mocked(headers).mockResolvedValue({ get: mockGet } as never);
      const { getActionClientIp } = await import("@/lib/request-utils");
      expect(await getActionClientIp()).toBe("11.22.33.44");
    });

    it("returns 'unknown' when trusted but no headers", async () => {
      process.env.TRUSTED_PROXIES = "*";
      const mockGet = vi.fn().mockReturnValue(null);
      const { headers } = await import("next/headers");
      vi.mocked(headers).mockResolvedValue({ get: mockGet } as never);
      const { getActionClientIp } = await import("@/lib/request-utils");
      expect(await getActionClientIp()).toBe("unknown");
    });
  });
});
