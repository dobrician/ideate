import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  enqueueAction,
  enqueueActionSafe,
  getQueuedActions,
  getOldestActions,
  removeAction,
  clearQueue,
  getQueueSize,
  replayAction,
  replayAll,
  type QueuedAction,
} from "@/lib/offline/sync-engine";

// ─── IndexedDB mock ─────────────────────────────────────────────────────

const store = new Map<string, QueuedAction>();

const mockObjectStore = {
  add: vi.fn((entry: QueuedAction) => {
    store.set(entry.id, entry);
    return { onsuccess: null, onerror: null };
  }),
  get: vi.fn((id: string) => {
    const req = { result: store.get(id), onsuccess: null as (() => void) | null, onerror: null };
    setTimeout(() => req.onsuccess?.(), 0);
    return req;
  }),
  put: vi.fn((entry: QueuedAction) => {
    store.set(entry.id, entry);
    return { onsuccess: null, onerror: null };
  }),
  delete: vi.fn((id: string) => {
    store.delete(id);
    return { onsuccess: null, onerror: null };
  }),
  clear: vi.fn(() => {
    store.clear();
    return { onsuccess: null, onerror: null };
  }),
  count: vi.fn(() => {
    const req = { result: store.size, onsuccess: null as (() => void) | null, onerror: null };
    setTimeout(() => req.onsuccess?.(), 0);
    return req;
  }),
  index: vi.fn(() => ({
    getAll: vi.fn(() => {
      const sorted = [...store.values()].sort((a, b) => a.timestamp - b.timestamp);
      const req = { result: sorted, onsuccess: null as (() => void) | null, onerror: null };
      setTimeout(() => req.onsuccess?.(), 0);
      return req;
    }),
  })),
  createIndex: vi.fn(),
};

const mockTransaction = {
  objectStore: vi.fn(() => mockObjectStore),
  oncomplete: null as (() => void) | null,
  onerror: null as (() => void) | null,
};

const mockDb = {
  transaction: vi.fn(() => {
    const tx = { ...mockTransaction, oncomplete: null, onerror: null };
    setTimeout(() => tx.oncomplete?.(), 0);
    return tx;
  }),
  objectStoreNames: { contains: vi.fn(() => false) },
  createObjectStore: vi.fn(() => mockObjectStore),
  close: vi.fn(),
};

const mockOpenRequest = {
  result: mockDb,
  onupgradeneeded: null as (() => void) | null,
  onsuccess: null as (() => void) | null,
  onerror: null as (() => void) | null,
  error: null,
};

vi.stubGlobal("indexedDB", {
  open: vi.fn(() => {
    setTimeout(() => {
      mockOpenRequest.onupgradeneeded?.();
      mockOpenRequest.onsuccess?.();
    }, 0);
    return mockOpenRequest;
  }),
});

// ─── Fetch mock ─────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

// ─── Tests ──────────────────────────────────────────────────────────────

describe("Offline Sync Engine", () => {
  describe("enqueueAction", () => {
    it("should enqueue an action and return an id", async () => {
      const id = await enqueueAction({
        type: "vote",
        method: "POST",
        url: "/api/votes",
        body: JSON.stringify({ proposalId: "p1", value: 1 }),
      });

      expect(id).toContain("vote-");
      expect(store.size).toBe(1);
    });

    it("should set timestamp and retries to 0", async () => {
      const id = await enqueueAction({
        type: "comment",
        method: "POST",
        url: "/api/comments",
        body: "{}",
      });

      const entry = store.get(id);
      expect(entry?.timestamp).toBeGreaterThan(0);
      expect(entry?.retries).toBe(0);
    });

    it("should support different action types", async () => {
      await enqueueAction({ type: "vote", method: "POST", url: "/api/votes", body: "{}" });
      await enqueueAction({ type: "comment", method: "POST", url: "/api/comments", body: "{}" });
      await enqueueAction({ type: "proposal", method: "POST", url: "/api/proposals", body: "{}" });
      expect(store.size).toBe(3);
    });
  });

  describe("getQueuedActions", () => {
    it("should return empty array when queue is empty", async () => {
      const actions = await getQueuedActions();
      expect(actions).toEqual([]);
    });

    it("should return actions sorted by timestamp", async () => {
      await enqueueAction({ type: "vote", method: "POST", url: "/api/votes", body: "1" });
      await enqueueAction({ type: "comment", method: "POST", url: "/api/comments", body: "2" });
      const actions = await getQueuedActions();
      expect(actions.length).toBe(2);
      expect(actions[0].timestamp).toBeLessThanOrEqual(actions[1].timestamp);
    });
  });

  describe("removeAction", () => {
    it("should remove an action by id", async () => {
      const id = await enqueueAction({ type: "vote", method: "POST", url: "/api/votes", body: "{}" });
      expect(store.size).toBe(1);
      await removeAction(id);
      expect(store.has(id)).toBe(false);
    });
  });

  describe("clearQueue", () => {
    it("should clear all queued actions", async () => {
      await enqueueAction({ type: "vote", method: "POST", url: "/api/votes", body: "{}" });
      await enqueueAction({ type: "comment", method: "POST", url: "/api/comments", body: "{}" });
      await clearQueue();
      expect(store.size).toBe(0);
    });
  });

  describe("getQueueSize", () => {
    it("should return the number of queued actions", async () => {
      await enqueueAction({ type: "vote", method: "POST", url: "/api/votes", body: "{}" });
      await enqueueAction({ type: "vote", method: "POST", url: "/api/votes", body: "{}" });
      const size = await getQueueSize();
      expect(size).toBe(2);
    });

    it("should return 0 when queue is empty", async () => {
      const size = await getQueueSize();
      expect(size).toBe(0);
    });
  });

  describe("replayAction", () => {
    it("should succeed and remove action on 200", async () => {
      const id = await enqueueAction({ type: "vote", method: "POST", url: "/api/votes", body: "{}" });
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      const result = await replayAction(store.get(id)!);
      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
    });

    it("should detect conflict on 409", async () => {
      const id = await enqueueAction({ type: "vote", method: "POST", url: "/api/votes", body: "{}" });
      mockFetch.mockResolvedValueOnce({ ok: false, status: 409 });

      const result = await replayAction(store.get(id)!);
      expect(result.success).toBe(false);
      expect(result.conflict).toBe(true);
      expect(result.status).toBe(409);
    });

    it("should retry on server error and increment retries", async () => {
      const id = await enqueueAction({ type: "vote", method: "POST", url: "/api/votes", body: "{}" });
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await replayAction(store.get(id)!);
      expect(result.success).toBe(false);
      expect(result.status).toBe(500);
    });

    it("should remove action after max retries on server error", async () => {
      const id = await enqueueAction({ type: "vote", method: "POST", url: "/api/votes", body: "{}" });
      const entry = store.get(id)!;
      entry.retries = 2; // already at max - 1
      store.set(id, entry);

      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await replayAction(entry);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Max retries");
    });

    it("should handle network errors", async () => {
      const id = await enqueueAction({ type: "vote", method: "POST", url: "/api/votes", body: "{}" });
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await replayAction(store.get(id)!);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("should remove action after max retries on network error", async () => {
      const id = await enqueueAction({ type: "vote", method: "POST", url: "/api/votes", body: "{}" });
      const entry = store.get(id)!;
      entry.retries = 2;
      store.set(id, entry);

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await replayAction(entry);
      expect(result.error).toContain("after 3 retries");
    });
  });

  describe("replayAll", () => {
    it("should replay all queued actions", async () => {
      await enqueueAction({ type: "vote", method: "POST", url: "/api/votes", body: "{}" });
      await enqueueAction({ type: "comment", method: "POST", url: "/api/comments", body: "{}" });

      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const results = await replayAll();
      expect(results.length).toBe(2);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it("should return empty array when queue is empty", async () => {
      const results = await replayAll();
      expect(results).toEqual([]);
    });
  });

  describe("enqueueActionSafe", () => {
    it("should enqueue when under limit", async () => {
      const id = await enqueueActionSafe({
        type: "vote",
        method: "POST",
        url: "/api/votes",
        body: "{}",
      });
      expect(id).toContain("vote-");
      expect(store.size).toBe(1);
    });

    it("should evict oldest entries when at max queue size", async () => {
      // Fill queue to 100 entries
      for (let i = 0; i < 100; i++) {
        store.set(`vote-${i}`, {
          id: `vote-${i}`,
          type: "vote",
          method: "POST",
          url: "/api/votes",
          body: "{}",
          timestamp: i,
          retries: 0,
        });
      }

      const id = await enqueueActionSafe({
        type: "comment",
        method: "POST",
        url: "/api/comments",
        body: "{}",
      });

      expect(id).toContain("comment-");
      // Should have evicted 20% (20) then added 1 = 81
      expect(store.size).toBe(81);
    });
  });

  describe("getOldestActions", () => {
    it("should return N oldest actions by timestamp", async () => {
      await enqueueAction({ type: "vote", method: "POST", url: "/api/votes", body: "1" });
      await enqueueAction({ type: "comment", method: "POST", url: "/api/comments", body: "2" });
      await enqueueAction({ type: "proposal", method: "POST", url: "/api/proposals", body: "3" });

      const oldest = await getOldestActions(2);
      expect(oldest.length).toBe(2);
    });

    it("should return all actions if count exceeds queue size", async () => {
      await enqueueAction({ type: "vote", method: "POST", url: "/api/votes", body: "{}" });
      const oldest = await getOldestActions(10);
      expect(oldest.length).toBe(1);
    });
  });

  describe("connection pooling", () => {
    it("should perform multiple operations without error (reuses connection)", async () => {
      await enqueueAction({ type: "vote", method: "POST", url: "/api/votes", body: "{}" });
      await enqueueAction({ type: "comment", method: "POST", url: "/api/comments", body: "{}" });
      const size = await getQueueSize();
      const actions = await getQueuedActions();

      expect(size).toBe(2);
      expect(actions.length).toBe(2);
    });

    it("should not close db after each operation", async () => {
      await enqueueAction({ type: "vote", method: "POST", url: "/api/votes", body: "{}" });
      await getQueueSize();

      // close should NOT be called between operations (pooled)
      expect(mockDb.close).not.toHaveBeenCalled();
    });
  });
});
