import { describe, it, expect } from "vitest";
import {
  DEFAULT_BUDGET,
  checkBudget,
  isWithinBudget,
} from "@/lib/perf-budget";

describe("perf-budget", () => {
  describe("DEFAULT_BUDGET", () => {
    it("defines all required fields", () => {
      expect(DEFAULT_BUDGET.maxJsBundleKB).toBe(250);
      expect(DEFAULT_BUDGET.maxCssBundleKB).toBe(50);
      expect(DEFAULT_BUDGET.maxFirstLoadKB).toBe(300);
      expect(DEFAULT_BUDGET.maxApiP95Ms).toBe(500);
      expect(DEFAULT_BUDGET.maxPageLoadMs).toBe(3000);
    });

    it("defines all Web Vitals thresholds", () => {
      expect(DEFAULT_BUDGET.vitals.maxLCP).toBe(2500);
      expect(DEFAULT_BUDGET.vitals.maxFID).toBe(100);
      expect(DEFAULT_BUDGET.vitals.maxCLS).toBe(0.1);
      expect(DEFAULT_BUDGET.vitals.maxINP).toBe(200);
      expect(DEFAULT_BUDGET.vitals.maxTTFB).toBe(800);
    });
  });

  describe("checkBudget", () => {
    it("returns empty array when all metrics within budget", () => {
      const violations = checkBudget({
        jsBundleKB: 200,
        cssBundleKB: 30,
        apiP95Ms: 300,
        lcp: 2000,
        cls: 0.05,
      });
      expect(violations).toEqual([]);
    });

    it("returns warning for metrics exceeding budget", () => {
      const violations = checkBudget({ jsBundleKB: 300 });
      expect(violations).toHaveLength(1);
      expect(violations[0].metric).toBe("jsBundleKB");
      expect(violations[0].severity).toBe("warning");
      expect(violations[0].actual).toBe(300);
      expect(violations[0].budget).toBe(250);
    });

    it("returns critical for metrics exceeding 1.5x budget", () => {
      const violations = checkBudget({ jsBundleKB: 400 });
      expect(violations).toHaveLength(1);
      expect(violations[0].severity).toBe("critical");
    });

    it("handles API P95 with 2x critical threshold", () => {
      // Warning: >500ms
      const warns = checkBudget({ apiP95Ms: 600 });
      expect(warns[0].severity).toBe("warning");

      // Critical: >1000ms (2x budget)
      const crits = checkBudget({ apiP95Ms: 1100 });
      expect(crits[0].severity).toBe("critical");
    });

    it("checks all Web Vitals metrics", () => {
      const violations = checkBudget({
        lcp: 5000,  // > 2500*1.5 = critical
        fid: 250,   // > 100*2 = critical
        cls: 0.3,   // > 0.1*2.5 = critical
        inp: 500,   // > 200*2 = critical
        ttfb: 1500, // > 800*1.5 = critical
      });
      expect(violations).toHaveLength(5);
      violations.forEach((v) => expect(v.severity).toBe("critical"));
    });

    it("ignores undefined metrics", () => {
      const violations = checkBudget({});
      expect(violations).toEqual([]);
    });

    it("accepts custom budget", () => {
      const custom = { ...DEFAULT_BUDGET, maxJsBundleKB: 500 };
      const violations = checkBudget({ jsBundleKB: 400 }, custom);
      expect(violations).toEqual([]);
    });

    it("detects CLS warning correctly", () => {
      // CLS: budget 0.1, critical at 0.25
      const violations = checkBudget({ cls: 0.15 });
      expect(violations).toHaveLength(1);
      expect(violations[0].severity).toBe("warning");
    });
  });

  describe("isWithinBudget", () => {
    it("returns true when all within budget", () => {
      expect(isWithinBudget({ jsBundleKB: 200, apiP95Ms: 400 })).toBe(true);
    });

    it("returns true for warnings (no critical)", () => {
      // JS 300 > 250 budget = warning but not critical (<375)
      expect(isWithinBudget({ jsBundleKB: 300 })).toBe(true);
    });

    it("returns false for critical violations", () => {
      expect(isWithinBudget({ jsBundleKB: 500 })).toBe(false);
    });

    it("returns true for empty metrics", () => {
      expect(isWithinBudget({})).toBe(true);
    });
  });
});
