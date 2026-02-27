import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

import { POST, GET } from "@/app/api/perf/vitals/route";

function createRequest(body: unknown): Request {
  return new Request("http://localhost/api/perf/vitals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("API /api/perf/vitals", () => {
  describe("POST", () => {
    it("stores valid metrics", async () => {
      const req = createRequest({
        metrics: [
          { name: "LCP", value: 2000, rating: "good" },
          { name: "FID", value: 50, rating: "good" },
        ],
        url: "/dashboard",
      });

      const res = await POST(req as never);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.stored).toBe(2);
    });

    it("rejects empty metrics array", async () => {
      const req = createRequest({ metrics: [] });
      const res = await POST(req as never);
      expect(res.status).toBe(400);
    });

    it("rejects non-array metrics", async () => {
      const req = createRequest({ metrics: "invalid" });
      const res = await POST(req as never);
      expect(res.status).toBe(400);
    });

    it("rejects too many metrics", async () => {
      const metrics = Array.from({ length: 25 }, (_, i) => ({
        name: "LCP",
        value: i * 100,
      }));
      const req = createRequest({ metrics });
      const res = await POST(req as never);
      expect(res.status).toBe(400);
    });

    it("skips metrics with invalid names", async () => {
      const req = createRequest({
        metrics: [
          { name: "INVALID", value: 100 },
          { name: "LCP", value: 2000 },
        ],
      });
      const res = await POST(req as never);
      const data = await res.json();
      expect(data.stored).toBe(1);
    });

    it("skips metrics with non-finite values", async () => {
      const req = createRequest({
        metrics: [
          { name: "LCP", value: NaN },
          { name: "FID", value: Infinity },
        ],
      });
      const res = await POST(req as never);
      const data = await res.json();
      expect(data.stored).toBe(0);
    });

    it("skips metrics with invalid rating", async () => {
      const req = createRequest({
        metrics: [{ name: "LCP", value: 2000, rating: "awesome" }],
      });
      const res = await POST(req as never);
      const data = await res.json();
      expect(data.stored).toBe(0);
    });

    it("handles invalid JSON body", async () => {
      const req = new Request("http://localhost/api/perf/vitals", {
        method: "POST",
        body: "not-json",
      });
      const res = await POST(req as never);
      expect(res.status).toBe(400);
    });

    it("truncates long URLs", async () => {
      const req = createRequest({
        metrics: [{ name: "LCP", value: 2000 }],
        url: "/" + "a".repeat(300),
      });
      const res = await POST(req as never);
      expect(res.status).toBe(200);
    });
  });

  describe("GET", () => {
    it("returns vitals summary", async () => {
      // First store some metrics
      const postReq = createRequest({
        metrics: [
          { name: "LCP", value: 2000, rating: "good" },
          { name: "LCP", value: 3000, rating: "needs-improvement" },
          { name: "FID", value: 50, rating: "good" },
        ],
        url: "/test",
      });
      await POST(postReq as never);

      const getReq = new Request("http://localhost/api/perf/vitals");
      const res = await GET();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.summary).toBeDefined();
      expect(data.totalEntries).toBeGreaterThanOrEqual(3);
    });

    it("returns summary with counts and averages", async () => {
      const res = await GET();
      const data = await res.json();
      expect(typeof data.totalEntries).toBe("number");
      expect(typeof data.recentEntries).toBe("number");
    });
  });
});
