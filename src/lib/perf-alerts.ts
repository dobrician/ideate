/**
 * Performance alerting system.
 * Detects performance regressions and generates alerts.
 */

import { logger } from "@/lib/logger";

/** Alert severity levels. */
export type AlertSeverity = "info" | "warning" | "critical";

/** Performance alert entry. */
export interface PerfAlert {
  id: string;
  metric: string;
  message: string;
  severity: AlertSeverity;
  value: number;
  threshold: number;
  timestamp: number;
}

/** Alert thresholds for different metrics. */
export interface AlertThresholds {
  apiP95Ms: { warning: number; critical: number };
  cacheHitRate: { warning: number; critical: number };
  memoryUsagePct: { warning: number; critical: number };
  errorRate: { warning: number; critical: number };
}

/** Default alert thresholds. */
export const DEFAULT_THRESHOLDS: AlertThresholds = {
  apiP95Ms: { warning: 500, critical: 1000 },
  cacheHitRate: { warning: 50, critical: 30 },
  memoryUsagePct: { warning: 80, critical: 95 },
  errorRate: { warning: 5, critical: 10 },
};

const MAX_ALERTS = 100;
const alerts: PerfAlert[] = [];
let alertCounter = 0;

/**
 * Evaluate metrics and generate alerts for threshold violations.
 * For cacheHitRate and similar: alert if value is BELOW threshold.
 * For others: alert if value is ABOVE threshold.
 */
export function evaluateMetrics(
  metrics: Partial<{
    apiP95Ms: number;
    cacheHitRate: number;
    memoryUsagePct: number;
    errorRate: number;
  }>,
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS,
): PerfAlert[] {
  const newAlerts: PerfAlert[] = [];

  // Higher-is-worse metrics
  const higherWorse: [string, number | undefined, { warning: number; critical: number }][] = [
    ["apiP95Ms", metrics.apiP95Ms, thresholds.apiP95Ms],
    ["memoryUsagePct", metrics.memoryUsagePct, thresholds.memoryUsagePct],
    ["errorRate", metrics.errorRate, thresholds.errorRate],
  ];

  for (const [metric, value, thresh] of higherWorse) {
    if (value === undefined) continue;
    if (value >= thresh.critical) {
      newAlerts.push(createAlert(metric, value, thresh.critical, "critical"));
    } else if (value >= thresh.warning) {
      newAlerts.push(createAlert(metric, value, thresh.warning, "warning"));
    }
  }

  // Lower-is-worse metrics (cache hit rate)
  if (metrics.cacheHitRate !== undefined) {
    if (metrics.cacheHitRate <= thresholds.cacheHitRate.critical) {
      newAlerts.push(createAlert("cacheHitRate", metrics.cacheHitRate, thresholds.cacheHitRate.critical, "critical"));
    } else if (metrics.cacheHitRate <= thresholds.cacheHitRate.warning) {
      newAlerts.push(createAlert("cacheHitRate", metrics.cacheHitRate, thresholds.cacheHitRate.warning, "warning"));
    }
  }

  // Store alerts
  for (const alert of newAlerts) {
    alerts.push(alert);
    if (alerts.length > MAX_ALERTS) alerts.shift();
    logger.warn({ alert }, "Performance alert triggered");
  }

  return newAlerts;
}

function createAlert(
  metric: string,
  value: number,
  threshold: number,
  severity: AlertSeverity,
): PerfAlert {
  alertCounter++;
  return {
    id: `alert-${alertCounter}`,
    metric,
    message: `${metric} ${severity}: ${value} (threshold: ${threshold})`,
    severity,
    value,
    threshold,
    timestamp: Date.now(),
  };
}

/** Get recent alerts, optionally filtered by severity. */
export function getAlerts(severity?: AlertSeverity): PerfAlert[] {
  if (!severity) return [...alerts];
  return alerts.filter((a) => a.severity === severity);
}

/** Clear all stored alerts. */
export function clearAlerts(): void {
  alerts.length = 0;
}

/** Get count of alerts by severity. */
export function getAlertCounts(): Record<AlertSeverity, number> {
  const counts: Record<AlertSeverity, number> = { info: 0, warning: 0, critical: 0 };
  for (const alert of alerts) {
    counts[alert.severity]++;
  }
  return counts;
}
