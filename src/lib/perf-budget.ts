/**
 * Performance budgets and threshold checking.
 * Defines acceptable limits for bundle sizes, response times, and Web Vitals.
 */

/** Performance budget thresholds. */
export interface PerfBudget {
  /** Maximum JavaScript bundle size in KB. */
  maxJsBundleKB: number;
  /** Maximum CSS bundle size in KB. */
  maxCssBundleKB: number;
  /** Maximum first-load JS size in KB. */
  maxFirstLoadKB: number;
  /** Maximum API response time in ms (p95). */
  maxApiP95Ms: number;
  /** Maximum page load time in ms. */
  maxPageLoadMs: number;
  /** Core Web Vitals thresholds. */
  vitals: {
    /** Largest Contentful Paint in ms. */
    maxLCP: number;
    /** First Input Delay in ms. */
    maxFID: number;
    /** Cumulative Layout Shift (unitless). */
    maxCLS: number;
    /** Interaction to Next Paint in ms. */
    maxINP: number;
    /** Time to First Byte in ms. */
    maxTTFB: number;
  };
}

/** Default performance budgets for the application. */
export const DEFAULT_BUDGET: PerfBudget = {
  maxJsBundleKB: 250,
  maxCssBundleKB: 50,
  maxFirstLoadKB: 300,
  maxApiP95Ms: 500,
  maxPageLoadMs: 3000,
  vitals: {
    maxLCP: 2500,
    maxFID: 100,
    maxCLS: 0.1,
    maxINP: 200,
    maxTTFB: 800,
  },
};

/** Result of a budget check. */
export interface BudgetViolation {
  metric: string;
  actual: number;
  budget: number;
  severity: "warning" | "critical";
}

/**
 * Check a set of metrics against the performance budget.
 * Returns an array of violations (empty if all within budget).
 */
export function checkBudget(
  metrics: Partial<{
    jsBundleKB: number;
    cssBundleKB: number;
    firstLoadKB: number;
    apiP95Ms: number;
    pageLoadMs: number;
    lcp: number;
    fid: number;
    cls: number;
    inp: number;
    ttfb: number;
  }>,
  budget: PerfBudget = DEFAULT_BUDGET,
): BudgetViolation[] {
  const violations: BudgetViolation[] = [];

  const checks: [string, number | undefined, number, number][] = [
    ["jsBundleKB", metrics.jsBundleKB, budget.maxJsBundleKB, budget.maxJsBundleKB * 1.5],
    ["cssBundleKB", metrics.cssBundleKB, budget.maxCssBundleKB, budget.maxCssBundleKB * 1.5],
    ["firstLoadKB", metrics.firstLoadKB, budget.maxFirstLoadKB, budget.maxFirstLoadKB * 1.5],
    ["apiP95Ms", metrics.apiP95Ms, budget.maxApiP95Ms, budget.maxApiP95Ms * 2],
    ["pageLoadMs", metrics.pageLoadMs, budget.maxPageLoadMs, budget.maxPageLoadMs * 1.5],
    ["lcp", metrics.lcp, budget.vitals.maxLCP, budget.vitals.maxLCP * 1.5],
    ["fid", metrics.fid, budget.vitals.maxFID, budget.vitals.maxFID * 2],
    ["cls", metrics.cls, budget.vitals.maxCLS, budget.vitals.maxCLS * 2.5],
    ["inp", metrics.inp, budget.vitals.maxINP, budget.vitals.maxINP * 2],
    ["ttfb", metrics.ttfb, budget.vitals.maxTTFB, budget.vitals.maxTTFB * 1.5],
  ];

  for (const [metric, actual, warn, crit] of checks) {
    if (actual === undefined) continue;
    if (actual > crit) {
      violations.push({ metric, actual, budget: warn, severity: "critical" });
    } else if (actual > warn) {
      violations.push({ metric, actual, budget: warn, severity: "warning" });
    }
  }

  return violations;
}

/**
 * Check if performance is within acceptable limits.
 * Returns true if no critical violations found.
 */
export function isWithinBudget(
  metrics: Parameters<typeof checkBudget>[0],
  budget?: PerfBudget,
): boolean {
  const violations = checkBudget(metrics, budget);
  return violations.every((v) => v.severity !== "critical");
}
