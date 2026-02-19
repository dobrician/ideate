/**
 * Memory and resource usage tracking.
 * Provides process-level memory stats and connection pool info.
 */

export interface MemoryStats {
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  externalMB: number;
  heapUsagePercent: number;
}

export interface ConnectionPoolStats {
  maxConnections: number;
  activeConnections: number;
  idleConnections: number;
}

export interface ResourceStats {
  memory: MemoryStats;
  connectionPool: ConnectionPoolStats;
  uptimeSeconds: number;
}

const toMB = (bytes: number) => Math.round((bytes / 1024 / 1024) * 100) / 100;

let poolStats: ConnectionPoolStats = {
  maxConnections: 1,
  activeConnections: 0,
  idleConnections: 1,
};

export function updatePoolStats(stats: ConnectionPoolStats): void {
  poolStats = { ...stats };
}

export function getMemoryStats(): MemoryStats {
  const mem = process.memoryUsage();
  return {
    heapUsedMB: toMB(mem.heapUsed),
    heapTotalMB: toMB(mem.heapTotal),
    rssMB: toMB(mem.rss),
    externalMB: toMB(mem.external),
    heapUsagePercent: Math.round((mem.heapUsed / mem.heapTotal) * 100),
  };
}

export function getResourceStats(): ResourceStats {
  return {
    memory: getMemoryStats(),
    connectionPool: { ...poolStats },
    uptimeSeconds: Math.floor(process.uptime()),
  };
}
