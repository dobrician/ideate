import { describe, it, expect, beforeEach } from "vitest";
import { getMemoryStats, getResourceStats, updatePoolStats } from "@/lib/resource-monitor";

describe("Resource Monitor", () => {
  describe("getMemoryStats", () => {
    it("returns memory stats with expected shape", () => {
      const stats = getMemoryStats();
      expect(stats.heapUsedMB).toBeGreaterThan(0);
      expect(stats.heapTotalMB).toBeGreaterThan(0);
      expect(stats.rssMB).toBeGreaterThan(0);
      expect(stats.externalMB).toBeGreaterThanOrEqual(0);
      expect(stats.heapUsagePercent).toBeGreaterThan(0);
      expect(stats.heapUsagePercent).toBeLessThanOrEqual(100);
    });

    it("returns values in megabytes (not bytes)", () => {
      const stats = getMemoryStats();
      // RSS should be reasonable MB range, not raw bytes
      expect(stats.rssMB).toBeLessThan(10_000);
      expect(stats.heapUsedMB).toBeLessThan(10_000);
    });
  });

  describe("getResourceStats", () => {
    beforeEach(() => {
      updatePoolStats({ maxConnections: 5, activeConnections: 2, idleConnections: 3 });
    });

    it("returns combined resource stats", () => {
      const stats = getResourceStats();
      expect(stats.memory).toBeDefined();
      expect(stats.connectionPool).toBeDefined();
      expect(stats.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it("includes connection pool stats", () => {
      const stats = getResourceStats();
      expect(stats.connectionPool.maxConnections).toBe(5);
      expect(stats.connectionPool.activeConnections).toBe(2);
      expect(stats.connectionPool.idleConnections).toBe(3);
    });

    it("includes process uptime", () => {
      const stats = getResourceStats();
      expect(typeof stats.uptimeSeconds).toBe("number");
      expect(stats.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });
  });

  describe("updatePoolStats", () => {
    it("updates pool stats reflected in getResourceStats", () => {
      updatePoolStats({ maxConnections: 10, activeConnections: 7, idleConnections: 3 });
      const stats = getResourceStats();
      expect(stats.connectionPool.maxConnections).toBe(10);
      expect(stats.connectionPool.activeConnections).toBe(7);
      expect(stats.connectionPool.idleConnections).toBe(3);
    });

    it("overwrites previous pool stats", () => {
      updatePoolStats({ maxConnections: 5, activeConnections: 1, idleConnections: 4 });
      updatePoolStats({ maxConnections: 8, activeConnections: 3, idleConnections: 5 });
      const stats = getResourceStats();
      expect(stats.connectionPool.maxConnections).toBe(8);
    });
  });
});
