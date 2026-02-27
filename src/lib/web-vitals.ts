/**
 * Core Web Vitals collection and reporting.
 * Collects LCP, FID, CLS, INP, TTFB metrics from the browser
 * and sends them to the analytics endpoint.
 */

/** Web Vitals metric entry. */
export interface VitalMetric {
  name: "LCP" | "FID" | "CLS" | "INP" | "TTFB";
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  navigationType: string;
}

/** Thresholds for rating Web Vitals metrics (from web.dev). */
const THRESHOLDS: Record<string, [number, number]> = {
  LCP: [2500, 4000],
  FID: [100, 300],
  CLS: [0.1, 0.25],
  INP: [200, 500],
  TTFB: [800, 1800],
};

/**
 * Rate a metric value as good, needs-improvement, or poor.
 */
export function rateMetric(
  name: string,
  value: number,
): "good" | "needs-improvement" | "poor" {
  const threshold = THRESHOLDS[name];
  if (!threshold) return "good";
  if (value <= threshold[0]) return "good";
  if (value <= threshold[1]) return "needs-improvement";
  return "poor";
}

/** Buffer to collect metrics before sending. */
const buffer: VitalMetric[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Record a Web Vitals metric.
 * Metrics are buffered and sent in batches.
 */
export function recordVital(
  name: VitalMetric["name"],
  value: number,
  navigationType = "navigate",
): void {
  const metric: VitalMetric = {
    name,
    value: Math.round(name === "CLS" ? value * 1000 : value) / (name === "CLS" ? 1000 : 1),
    rating: rateMetric(name, value),
    navigationType,
  };

  buffer.push(metric);

  // Debounce: flush after 5 seconds of no new metrics
  if (flushTimeout) clearTimeout(flushTimeout);
  flushTimeout = setTimeout(flushVitals, 5000);
}

/**
 * Send buffered metrics to the analytics endpoint.
 */
export function flushVitals(): void {
  if (buffer.length === 0) return;

  const metrics = buffer.splice(0, buffer.length);

  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    navigator.sendBeacon(
      "/api/perf/vitals",
      JSON.stringify({ metrics, url: typeof location !== "undefined" ? location.pathname : "/" }),
    );
  }
}

/** Get the current buffer contents (for testing). */
export function getVitalsBuffer(): VitalMetric[] {
  return [...buffer];
}

/** Clear the buffer (for testing). */
export function clearVitalsBuffer(): void {
  buffer.length = 0;
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
}
