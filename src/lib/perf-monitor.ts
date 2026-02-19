/**
 * In-memory performance metrics collector.
 * Tracks request response times using a circular buffer.
 */

interface RequestTiming {
  path: string;
  method: string;
  status: number;
  durationMs: number;
  timestamp: number;
}

const MAX_ENTRIES = 1000;
const timings: RequestTiming[] = [];

export function recordTiming(entry: RequestTiming): void {
  timings.push(entry);
  if (timings.length > MAX_ENTRIES) {
    timings.shift();
  }
}

export interface PerfStats {
  totalRequests: number;
  avgResponseMs: number;
  p95ResponseMs: number;
  p99ResponseMs: number;
  slowestPaths: { path: string; avgMs: number; count: number }[];
  statusCodes: Record<string, number>;
  recentTimings: RequestTiming[];
}

export function getPerfStats(): PerfStats {
  if (timings.length === 0) {
    return {
      totalRequests: 0,
      avgResponseMs: 0,
      p95ResponseMs: 0,
      p99ResponseMs: 0,
      slowestPaths: [],
      statusCodes: {},
      recentTimings: [],
    };
  }

  const durations = timings.map((t) => t.durationMs).sort((a, b) => a - b);
  const avg = Math.round(durations.reduce((s, d) => s + d, 0) / durations.length);
  const p95 = durations[Math.floor(durations.length * 0.95)] ?? 0;
  const p99 = durations[Math.floor(durations.length * 0.99)] ?? 0;

  // Aggregate by path
  const pathMap = new Map<string, { totalMs: number; count: number }>();
  const statusCodes: Record<string, number> = {};
  for (const t of timings) {
    const existing = pathMap.get(t.path);
    if (existing) {
      existing.totalMs += t.durationMs;
      existing.count++;
    } else {
      pathMap.set(t.path, { totalMs: t.durationMs, count: 1 });
    }
    const code = String(t.status);
    statusCodes[code] = (statusCodes[code] ?? 0) + 1;
  }

  const slowestPaths = Array.from(pathMap.entries())
    .map(([path, { totalMs, count }]) => ({ path, avgMs: Math.round(totalMs / count), count }))
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, 10);

  return {
    totalRequests: timings.length,
    avgResponseMs: avg,
    p95ResponseMs: p95,
    p99ResponseMs: p99,
    slowestPaths,
    statusCodes,
    recentTimings: timings.slice(-20).reverse(),
  };
}

export function resetPerfStats(): void {
  timings.length = 0;
}
