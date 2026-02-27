import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

import {
  DEFAULT_THRESHOLDS,
  evaluateMetrics,
  getAlerts,
  clearAlerts,
  getAlertCounts,
} from "@/lib/perf-alerts";

describe("perf-alerts", () => {
  beforeEach(() => {
    clearAlerts();
  });

  describe("DEFAULT_THRESHOLDS", () => {
    it("defines all threshold categories", () => {
      expect(DEFAULT_THRESHOLDS.apiP95Ms).toBeDefined();
      expect(DEFAULT_THRESHOLDS.cacheHitRate).toBeDefined();
      expect(DEFAULT_THRESHOLDS.memoryUsagePct).toBeDefined();
      expect(DEFAULT_THRESHOLDS.errorRate).toBeDefined();
    });
  });

  describe("evaluateMetrics", () => {
    it("returns empty array when all metrics within bounds", () => {
      const alerts = evaluateMetrics({
        apiP95Ms: 200,
        cacheHitRate: 80,
        memoryUsagePct: 50,
        errorRate: 1,
      });
      expect(alerts).toHaveLength(0);
    });

    it("generates warning for API P95 exceeding threshold", () => {
      const alerts = evaluateMetrics({ apiP95Ms: 600 });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].metric).toBe("apiP95Ms");
      expect(alerts[0].severity).toBe("warning");
      expect(alerts[0].value).toBe(600);
      expect(alerts[0].threshold).toBe(500);
    });

    it("generates critical alert for API P95 exceeding critical threshold", () => {
      const alerts = evaluateMetrics({ apiP95Ms: 1200 });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe("critical");
    });

    it("generates warning for low cache hit rate", () => {
      const alerts = evaluateMetrics({ cacheHitRate: 45 });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].metric).toBe("cacheHitRate");
      expect(alerts[0].severity).toBe("warning");
    });

    it("generates critical for very low cache hit rate", () => {
      const alerts = evaluateMetrics({ cacheHitRate: 20 });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe("critical");
    });

    it("generates alert for high memory usage", () => {
      const alerts = evaluateMetrics({ memoryUsagePct: 85 });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].metric).toBe("memoryUsagePct");
      expect(alerts[0].severity).toBe("warning");
    });

    it("generates alert for high error rate", () => {
      const alerts = evaluateMetrics({ errorRate: 7 });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].metric).toBe("errorRate");
      expect(alerts[0].severity).toBe("warning");
    });

    it("generates multiple alerts for multiple violations", () => {
      const alerts = evaluateMetrics({
        apiP95Ms: 1500,
        memoryUsagePct: 96,
        errorRate: 12,
      });
      expect(alerts).toHaveLength(3);
      expect(alerts.every((a) => a.severity === "critical")).toBe(true);
    });

    it("ignores undefined metrics", () => {
      const alerts = evaluateMetrics({});
      expect(alerts).toHaveLength(0);
    });

    it("stores alerts for later retrieval", () => {
      evaluateMetrics({ apiP95Ms: 600 });
      evaluateMetrics({ memoryUsagePct: 85 });
      expect(getAlerts()).toHaveLength(2);
    });

    it("assigns unique IDs to alerts", () => {
      evaluateMetrics({ apiP95Ms: 600 });
      evaluateMetrics({ memoryUsagePct: 85 });
      const alerts = getAlerts();
      expect(alerts[0].id).not.toBe(alerts[1].id);
    });

    it("accepts custom thresholds", () => {
      const custom = {
        ...DEFAULT_THRESHOLDS,
        apiP95Ms: { warning: 1000, critical: 2000 },
      };
      const alerts = evaluateMetrics({ apiP95Ms: 600 }, custom);
      expect(alerts).toHaveLength(0);
    });
  });

  describe("getAlerts", () => {
    it("returns all alerts when no severity filter", () => {
      evaluateMetrics({ apiP95Ms: 600 }); // warning
      evaluateMetrics({ apiP95Ms: 1200 }); // critical
      expect(getAlerts()).toHaveLength(2);
    });

    it("filters by severity", () => {
      evaluateMetrics({ apiP95Ms: 600 }); // warning
      evaluateMetrics({ apiP95Ms: 1200 }); // critical
      expect(getAlerts("warning")).toHaveLength(1);
      expect(getAlerts("critical")).toHaveLength(1);
      expect(getAlerts("info")).toHaveLength(0);
    });
  });

  describe("clearAlerts", () => {
    it("removes all stored alerts", () => {
      evaluateMetrics({ apiP95Ms: 600 });
      clearAlerts();
      expect(getAlerts()).toHaveLength(0);
    });
  });

  describe("getAlertCounts", () => {
    it("returns counts by severity", () => {
      evaluateMetrics({ apiP95Ms: 600 }); // warning
      evaluateMetrics({ apiP95Ms: 1200 }); // critical
      evaluateMetrics({ memoryUsagePct: 85 }); // warning

      const counts = getAlertCounts();
      expect(counts.warning).toBe(2);
      expect(counts.critical).toBe(1);
      expect(counts.info).toBe(0);
    });

    it("returns all zeroes when empty", () => {
      expect(getAlertCounts()).toEqual({ info: 0, warning: 0, critical: 0 });
    });
  });
});
