import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────
const mockInsertValues = vi.fn().mockResolvedValue(undefined);
const mockSelectFrom = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);

vi.mock("@/db", () => ({
  db: {
    insert: () => ({ values: mockInsertValues }),
    select: (fields?: unknown) => ({ from: (...args: unknown[]) => mockSelectFrom(fields, ...args) }),
    update: () => ({ set: mockUpdateSet }),
  },
}));

vi.mock("@/db/schema", () => ({ jobQueue: Symbol("jobQueue") }));
vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  },
}));

vi.mock("crypto", async () => {
  const actual = await vi.importActual("crypto");
  let counter = 0;
  return {
    ...actual,
    randomUUID: () => `uuid-${++counter}`,
  };
});

import { enqueue, process as processJobs, retry, getQueueStats, registerHandler } from "@/lib/queue";

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Job Queue", () => {
  describe("enqueue", () => {
    it("inserts a job with defaults", async () => {
      const id = await enqueue("email.send", { to: "user@test.com" });
      expect(id).toMatch(/^uuid-/);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "email.send",
          payload: JSON.stringify({ to: "user@test.com" }),
          status: "pending",
          attempts: 0,
          maxAttempts: 3,
        }),
      );
    });

    it("accepts custom runAt and maxAttempts", async () => {
      const runAt = new Date("2026-03-01");
      await enqueue("report.generate", {}, { runAt, maxAttempts: 5 });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          maxAttempts: 5,
          runAt,
        }),
      );
    });

    it("defaults to empty payload when none provided", async () => {
      await enqueue("cleanup");
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ payload: "{}" }),
      );
    });
  });

  describe("process", () => {
    it("returns zeros when no pending jobs", async () => {
      mockSelectFrom.mockReturnValue({
        where: () => ({ limit: () => Promise.resolve([]) }),
      });
      const result = await processJobs();
      expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 });
    });

    it("processes a job successfully", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      registerHandler("test.job", handler);

      mockSelectFrom.mockReturnValue({
        where: () => ({
          limit: () =>
            Promise.resolve([
              { id: "j1", type: "test.job", payload: '{"key":"val"}', status: "pending", attempts: 0, maxAttempts: 3 },
            ]),
        }),
      });
      mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });

      const result = await processJobs();
      expect(handler).toHaveBeenCalledWith({ key: "val" });
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);
    });

    it("marks job as dead when no handler registered", async () => {
      mockSelectFrom.mockReturnValue({
        where: () => ({
          limit: () =>
            Promise.resolve([
              { id: "j2", type: "unknown.type", payload: "{}", status: "pending", attempts: 0, maxAttempts: 3 },
            ]),
        }),
      });
      mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });

      const result = await processJobs();
      expect(result.failed).toBe(1);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "dead", lastError: "No handler for type: unknown.type" }),
      );
    });

    it("retries job on failure when attempts remain", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("Temporary failure"));
      registerHandler("retry.job", handler);

      mockSelectFrom.mockReturnValue({
        where: () => ({
          limit: () =>
            Promise.resolve([
              { id: "j3", type: "retry.job", payload: "{}", status: "pending", attempts: 0, maxAttempts: 3 },
            ]),
        }),
      });
      mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });

      const result = await processJobs();
      expect(result.failed).toBe(1);
      // Should set status back to pending with a retry runAt
      const setCalls = mockUpdateSet.mock.calls;
      const lastSetCall = setCalls[setCalls.length - 1][0];
      expect(lastSetCall.status).toBe("pending");
      expect(lastSetCall.lastError).toBe("Temporary failure");
      expect(lastSetCall.runAt).toBeInstanceOf(Date);
    });

    it("marks job as dead when max attempts exhausted", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("Final failure"));
      registerHandler("dead.job", handler);

      mockSelectFrom.mockReturnValue({
        where: () => ({
          limit: () =>
            Promise.resolve([
              { id: "j4", type: "dead.job", payload: "{}", status: "pending", attempts: 2, maxAttempts: 3 },
            ]),
        }),
      });
      mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });

      const result = await processJobs();
      expect(result.failed).toBe(1);
      const setCalls = mockUpdateSet.mock.calls;
      const lastSetCall = setCalls[setCalls.length - 1][0];
      expect(lastSetCall.status).toBe("dead");
      expect(lastSetCall.lastError).toBe("Final failure");
    });

    it("handles non-Error throws from handler", async () => {
      const handler = vi.fn().mockRejectedValue("string error");
      registerHandler("str.error", handler);

      mockSelectFrom.mockReturnValue({
        where: () => ({
          limit: () =>
            Promise.resolve([
              { id: "j5", type: "str.error", payload: "{}", status: "pending", attempts: 2, maxAttempts: 3 },
            ]),
        }),
      });
      mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });

      await processJobs();
      const setCalls = mockUpdateSet.mock.calls;
      const lastSetCall = setCalls[setCalls.length - 1][0];
      expect(lastSetCall.lastError).toBe("string error");
    });

    it("respects batchSize parameter", async () => {
      mockSelectFrom.mockReturnValue({
        where: () => ({ limit: (n: number) => { expect(n).toBe(5); return Promise.resolve([]); } }),
      });
      await processJobs(5);
    });
  });

  describe("retry", () => {
    it("returns false when job not found", async () => {
      mockSelectFrom.mockReturnValue({
        where: () => ({ limit: () => Promise.resolve([]) }),
      });
      expect(await retry("nonexistent")).toBe(false);
    });

    it("returns false when job is not in failed/dead state", async () => {
      mockSelectFrom.mockReturnValue({
        where: () => ({ limit: () => Promise.resolve([{ id: "j6", status: "completed" }]) }),
      });
      expect(await retry("j6")).toBe(false);
    });

    it("resets a dead job to pending", async () => {
      mockSelectFrom.mockReturnValue({
        where: () => ({ limit: () => Promise.resolve([{ id: "j7", status: "dead" }]) }),
      });
      mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });

      expect(await retry("j7")).toBe(true);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "pending", attempts: 0, lastError: null }),
      );
    });

    it("resets a failed job to pending", async () => {
      mockSelectFrom.mockReturnValue({
        where: () => ({ limit: () => Promise.resolve([{ id: "j8", status: "failed" }]) }),
      });
      mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });

      expect(await retry("j8")).toBe(true);
    });
  });

  describe("getQueueStats", () => {
    it("returns queue statistics", async () => {
      mockSelectFrom.mockReturnValue(
        Promise.resolve([{ pending: 5, processing: 2, completed: 10, failed: 1, dead: 0 }]),
      );

      const stats = await getQueueStats();
      expect(stats).toEqual({ pending: 5, processing: 2, completed: 10, failed: 1, dead: 0 });
    });

    it("handles null stats gracefully", async () => {
      mockSelectFrom.mockReturnValue(
        Promise.resolve([null]),
      );

      const stats = await getQueueStats();
      expect(stats).toEqual({ pending: 0, processing: 0, completed: 0, failed: 0, dead: 0 });
    });
  });
});
