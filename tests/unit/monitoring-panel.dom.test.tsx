// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MonitoringPanel } from "@/app/admin/monitoring/monitoring-panel";

vi.mock("@/lib/use-locale", () => ({
  useLocale: () => ({
    t: (key: string, vars?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        "monitoring.totalRequests": "Total Requests",
        "monitoring.avgResponse": "Avg Response",
        "monitoring.cacheHitRate": "Cache Hit Rate",
        "monitoring.queuePending": "Queue Pending",
        "monitoring.hits": "hits",
        "monitoring.misses": "misses",
        "monitoring.hitRate": "Hit Rate",
        "monitoring.completed": "completed",
        "monitoring.queueStats": "Job Queue Status",
        "monitoring.queueDesc": "Background job processing status breakdown",
        "monitoring.cacheStats": "Cache Statistics",
        "monitoring.memEntries": `${vars?.count} in-memory entries`,
        "monitoring.slowestPaths": "Slowest Paths",
        "monitoring.slowestDesc": "Top 10 paths by average response time",
        "monitoring.path": "Path",
        "monitoring.avgMs": "Avg Time",
        "monitoring.requests": "Requests",
        "monitoring.recentRequests": "Recent Requests",
        "monitoring.method": "Method",
        "monitoring.status": "Status",
        "monitoring.duration": "Duration",
        "monitoring.memoryUsage": "Memory Usage",
        "monitoring.uptime": `Uptime: ${vars?.time ?? ""}`,
        "monitoring.heapUsed": "Heap Used",
        "monitoring.heapTotal": "Heap Total",
        "monitoring.rss": "RSS",
        "monitoring.heapUsage": "Heap %",
        "monitoring.connectionPool": "Connection Pool",
        "monitoring.connectionPoolDesc": "SQLite read/write connection pool status",
        "monitoring.maxConnections": "Max",
        "monitoring.activeConnections": "Active",
        "monitoring.idleConnections": "Idle",
        "monitoring.redisCache": "Redis Cache",
        "monitoring.redisConnected": "Redis L2 cache is active",
        "monitoring.redisDisabled": "Redis not connected",
        "monitoring.redisHits": "Redis Hits",
        "monitoring.redisMisses": "Redis Misses",
        "monitoring.redisStatusOn": "ON",
        "monitoring.redisStatusOff": "OFF",
      };
      return translations[key] ?? key;
    },
    locale: "en",
  }),
}));

const perfStats = {
  totalRequests: 150,
  avgResponseMs: 42,
  p95ResponseMs: 120,
  p99ResponseMs: 250,
  slowestPaths: [{ path: "/api/slow", avgMs: 200, count: 5 }],
  statusCodes: { "200": 140, "404": 10 },
  recentTimings: [
    { path: "/api/test", method: "GET", status: 200, durationMs: 30, timestamp: Date.now() },
  ],
};

const cacheStats = {
  hits: 80,
  misses: 20,
  hitRate: 80,
  memEntries: 45,
  redisHits: 30,
  redisMisses: 10,
  redisEnabled: true,
};
const queueStats = { pending: 3, processing: 1, completed: 50, failed: 2, dead: 0 };
const resourceStats = {
  memory: { heapUsedMB: 64.5, heapTotalMB: 128, rssMB: 180.2, externalMB: 2.1, heapUsagePercent: 50 },
  connectionPool: { maxConnections: 5, activeConnections: 2, idleConnections: 3 },
  uptimeSeconds: 3661,
};

describe("MonitoringPanel", () => {
  it("renders overview stat cards", () => {
    render(<MonitoringPanel perfStats={perfStats} cacheStats={cacheStats} queueStats={queueStats} resourceStats={resourceStats} />);

    expect(screen.getByText("Total Requests")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.getByText("42ms")).toBeInTheDocument();
    expect(screen.getAllByText("80%").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(1);
  });

  it("renders job queue status grid", () => {
    render(<MonitoringPanel perfStats={perfStats} cacheStats={cacheStats} queueStats={queueStats} resourceStats={resourceStats} />);

    expect(screen.getByText("Job Queue Status")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeTruthy();
  });

  it("renders cache statistics", () => {
    render(<MonitoringPanel perfStats={perfStats} cacheStats={cacheStats} queueStats={queueStats} resourceStats={resourceStats} />);

    expect(screen.getByText("Cache Statistics")).toBeInTheDocument();
    expect(screen.getByText("45 in-memory entries")).toBeInTheDocument();
  });

  it("renders Redis cache section", () => {
    render(<MonitoringPanel perfStats={perfStats} cacheStats={cacheStats} queueStats={queueStats} resourceStats={resourceStats} />);

    expect(screen.getByText("Redis Cache")).toBeInTheDocument();
    expect(screen.getByText("Redis Hits")).toBeInTheDocument();
    expect(screen.getByText("Redis Misses")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("ON")).toBeInTheDocument();
  });

  it("shows Redis as disabled when not enabled", () => {
    const disabledCache = { ...cacheStats, redisEnabled: false };
    render(<MonitoringPanel perfStats={perfStats} cacheStats={disabledCache} queueStats={queueStats} resourceStats={resourceStats} />);

    expect(screen.getByText("OFF")).toBeInTheDocument();
    expect(screen.getByText("Redis not connected")).toBeInTheDocument();
  });

  it("renders slowest paths table", () => {
    render(<MonitoringPanel perfStats={perfStats} cacheStats={cacheStats} queueStats={queueStats} resourceStats={resourceStats} />);

    expect(screen.getByText("Slowest Paths")).toBeInTheDocument();
    expect(screen.getByText("/api/slow")).toBeInTheDocument();
    expect(screen.getByText("200ms")).toBeInTheDocument();
  });

  it("renders recent requests", () => {
    render(<MonitoringPanel perfStats={perfStats} cacheStats={cacheStats} queueStats={queueStats} resourceStats={resourceStats} />);

    expect(screen.getByText("Recent Requests")).toBeInTheDocument();
    expect(screen.getByText("/api/test")).toBeInTheDocument();
  });

  it("renders memory usage section", () => {
    render(<MonitoringPanel perfStats={perfStats} cacheStats={cacheStats} queueStats={queueStats} resourceStats={resourceStats} />);

    expect(screen.getByText("Memory Usage")).toBeInTheDocument();
    expect(screen.getByText("64.5MB")).toBeInTheDocument();
    expect(screen.getByText("128MB")).toBeInTheDocument();
    expect(screen.getByText("180.2MB")).toBeInTheDocument();
    expect(screen.getByText("Heap Used")).toBeInTheDocument();
  });

  it("renders connection pool section", () => {
    render(<MonitoringPanel perfStats={perfStats} cacheStats={cacheStats} queueStats={queueStats} resourceStats={resourceStats} />);

    expect(screen.getByText("Connection Pool")).toBeInTheDocument();
    expect(screen.getByText("Idle")).toBeInTheDocument();
  });

  it("renders uptime", () => {
    render(<MonitoringPanel perfStats={perfStats} cacheStats={cacheStats} queueStats={queueStats} resourceStats={resourceStats} />);

    expect(screen.getByText("Uptime: 1h 1m 1s")).toBeInTheDocument();
  });

  it("hides slowest paths when empty", () => {
    const emptyPerf = { ...perfStats, slowestPaths: [], recentTimings: [] };
    render(<MonitoringPanel perfStats={emptyPerf} cacheStats={cacheStats} queueStats={queueStats} resourceStats={resourceStats} />);

    expect(screen.queryByText("Slowest Paths")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent Requests")).not.toBeInTheDocument();
  });
});
