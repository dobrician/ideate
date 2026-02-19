import { describe, it, expect, beforeEach } from "vitest";
import { recordTiming, getPerfStats, resetPerfStats } from "@/lib/perf-monitor";

beforeEach(() => {
  resetPerfStats();
});

describe("Performance Monitor", () => {
  describe("recordTiming + getPerfStats", () => {
    it("returns zero stats when no timings recorded", () => {
      const stats = getPerfStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.avgResponseMs).toBe(0);
      expect(stats.p95ResponseMs).toBe(0);
      expect(stats.p99ResponseMs).toBe(0);
      expect(stats.slowestPaths).toEqual([]);
      expect(stats.recentTimings).toEqual([]);
    });

    it("records and aggregates request timings", () => {
      recordTiming({ path: "/api/test", method: "GET", status: 200, durationMs: 50, timestamp: Date.now() });
      recordTiming({ path: "/api/test", method: "GET", status: 200, durationMs: 150, timestamp: Date.now() });
      recordTiming({ path: "/api/other", method: "POST", status: 201, durationMs: 100, timestamp: Date.now() });

      const stats = getPerfStats();
      expect(stats.totalRequests).toBe(3);
      expect(stats.avgResponseMs).toBe(100);
    });

    it("calculates percentiles correctly", () => {
      for (let i = 1; i <= 100; i++) {
        recordTiming({ path: "/", method: "GET", status: 200, durationMs: i, timestamp: Date.now() });
      }

      const stats = getPerfStats();
      expect(stats.p95ResponseMs).toBe(96);
      expect(stats.p99ResponseMs).toBe(100);
    });

    it("tracks slowest paths", () => {
      recordTiming({ path: "/slow", method: "GET", status: 200, durationMs: 500, timestamp: Date.now() });
      recordTiming({ path: "/fast", method: "GET", status: 200, durationMs: 10, timestamp: Date.now() });

      const stats = getPerfStats();
      expect(stats.slowestPaths[0].path).toBe("/slow");
      expect(stats.slowestPaths[0].avgMs).toBe(500);
    });

    it("tracks status code distribution", () => {
      recordTiming({ path: "/", method: "GET", status: 200, durationMs: 10, timestamp: Date.now() });
      recordTiming({ path: "/", method: "GET", status: 200, durationMs: 10, timestamp: Date.now() });
      recordTiming({ path: "/", method: "GET", status: 404, durationMs: 5, timestamp: Date.now() });

      const stats = getPerfStats();
      expect(stats.statusCodes["200"]).toBe(2);
      expect(stats.statusCodes["404"]).toBe(1);
    });

    it("limits to most recent 20 in recentTimings", () => {
      for (let i = 0; i < 30; i++) {
        recordTiming({ path: `/path-${i}`, method: "GET", status: 200, durationMs: i, timestamp: Date.now() });
      }

      const stats = getPerfStats();
      expect(stats.recentTimings).toHaveLength(20);
    });

    it("evicts oldest entries when exceeding max capacity", () => {
      for (let i = 0; i < 1005; i++) {
        recordTiming({ path: `/p-${i}`, method: "GET", status: 200, durationMs: 10, timestamp: Date.now() });
      }

      const stats = getPerfStats();
      expect(stats.totalRequests).toBe(1000);
    });

    it("limits slowest paths to top 10", () => {
      for (let i = 0; i < 20; i++) {
        recordTiming({ path: `/path-${i}`, method: "GET", status: 200, durationMs: i * 10, timestamp: Date.now() });
      }

      const stats = getPerfStats();
      expect(stats.slowestPaths.length).toBeLessThanOrEqual(10);
    });
  });

  describe("resetPerfStats", () => {
    it("clears all recorded timings", () => {
      recordTiming({ path: "/", method: "GET", status: 200, durationMs: 50, timestamp: Date.now() });
      resetPerfStats();

      const stats = getPerfStats();
      expect(stats.totalRequests).toBe(0);
    });
  });
});
