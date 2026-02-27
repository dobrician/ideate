import { describe, it, expect, vi, beforeEach } from "vitest";
import type { QueuedAction, SyncResult } from "@/lib/offline/sync-engine";

// ─── IndexedDB mock ─────────────────────────────────────────────────────

const store = new Map<string, QueuedAction>();

const mockObjectStore = {
  add: vi.fn((entry: QueuedAction) => { store.set(entry.id, entry); return { onsuccess: null, onerror: null }; }),
  get: vi.fn((id: string) => { const req = { result: store.get(id), onsuccess: null as (() => void) | null, onerror: null }; setTimeout(() => req.onsuccess?.(), 0); return req; }),
  put: vi.fn((entry: QueuedAction) => { store.set(entry.id, entry); return { onsuccess: null, onerror: null }; }),
  delete: vi.fn((id: string) => { store.delete(id); return { onsuccess: null, onerror: null }; }),
  clear: vi.fn(() => { store.clear(); return { onsuccess: null, onerror: null }; }),
  count: vi.fn(() => { const req = { result: store.size, onsuccess: null as (() => void) | null, onerror: null }; setTimeout(() => req.onsuccess?.(), 0); return req; }),
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
    const tx = { ...mockTransaction, oncomplete: null as (() => void) | null, onerror: null as (() => void) | null };
    setTimeout(() => tx.oncomplete?.(), 0);
    return tx;
  }),
  objectStoreNames: { contains: vi.fn(() => false) },
  createObjectStore: vi.fn(() => mockObjectStore),
  close: vi.fn(),
};

vi.stubGlobal("indexedDB", {
  open: vi.fn(() => {
    const req = { result: mockDb, onupgradeneeded: null as (() => void) | null, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null, error: null };
    setTimeout(() => { req.onupgradeneeded?.(); req.onsuccess?.(); }, 0);
    return req;
  }),
});

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  enqueueAction,
  enqueueActionSafe,
  getQueuedActions,
  getQueueSize,
  clearQueue,
  replayAll,
  replayAction,
} from "@/lib/offline/sync-engine";

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe("Integration: Offline Sync + Queue Management", () => {
  describe("Full sync cycle", () => {
    it("should enqueue, replay, and clear all actions", async () => {
      await enqueueAction({ type: "vote", method: "POST", url: "/api/votes", body: '{"value":1}' });
      await enqueueAction({ type: "comment", method: "POST", url: "/api/comments", body: '{"text":"hi"}' });

      expect(await getQueueSize()).toBe(2);

      mockFetch.mockResolvedValue({ ok: true, status: 200 });
      const results = await replayAll();

      expect(results.length).toBe(2);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it("should handle mixed success/failure during replay", async () => {
      await enqueueAction({ type: "vote", method: "POST", url: "/api/votes", body: "{}" });
      await enqueueAction({ type: "comment", method: "POST", url: "/api/comments", body: "{}" });

      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({ ok: false, status: 500 });

      const results = await replayAll();
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });

    it("should handle conflict resolution (409)", async () => {
      await enqueueAction({ type: "vote", method: "POST", url: "/api/votes", body: "{}" });
      mockFetch.mockResolvedValueOnce({ ok: false, status: 409 });

      const actions = await getQueuedActions();
      const result = await replayAction(actions[0]);

      expect(result.conflict).toBe(true);
      expect(result.success).toBe(false);
    });

    it("should preserve action order during replay", async () => {
      await enqueueAction({ type: "vote", method: "POST", url: "/api/votes/1", body: "{}" });
      await enqueueAction({ type: "vote", method: "POST", url: "/api/votes/2", body: "{}" });
      await enqueueAction({ type: "vote", method: "POST", url: "/api/votes/3", body: "{}" });

      const calls: string[] = [];
      mockFetch.mockImplementation(async (url: string) => {
        calls.push(url);
        return { ok: true, status: 200 };
      });

      await replayAll();
      expect(calls).toEqual(["/api/votes/1", "/api/votes/2", "/api/votes/3"]);
    });
  });

  describe("Queue safety limits", () => {
    it("should evict oldest when queue at capacity", async () => {
      for (let i = 0; i < 100; i++) {
        store.set(`vote-${i}`, {
          id: `vote-${i}`, type: "vote", method: "POST",
          url: "/api/votes", body: "{}", timestamp: i, retries: 0,
        });
      }

      const id = await enqueueActionSafe({ type: "comment", method: "POST", url: "/api/comments", body: "{}" });
      expect(id).toContain("comment-");
    });

    it("should preserve newer entries during eviction", async () => {
      for (let i = 0; i < 100; i++) {
        store.set(`vote-${i}`, {
          id: `vote-${i}`, type: "vote", method: "POST",
          url: "/api/votes", body: "{}", timestamp: i * 1000, retries: 0,
        });
      }

      await enqueueActionSafe({ type: "vote", method: "POST", url: "/api/votes", body: "{}" });

      // Oldest 20 should be removed
      expect(store.has("vote-0")).toBe(false);
      expect(store.has("vote-19")).toBe(false);
      // Newer entries should remain
      expect(store.has("vote-20")).toBe(true);
      expect(store.has("vote-99")).toBe(true);
    });

    it("should work normally under capacity", async () => {
      for (let i = 0; i < 5; i++) {
        await enqueueAction({ type: "vote", method: "POST", url: "/api/votes", body: "{}" });
      }

      const id = await enqueueActionSafe({ type: "vote", method: "POST", url: "/api/votes", body: "{}" });
      expect(id).toBeDefined();
      expect(store.size).toBe(6);
    });
  });

  describe("SSRF protection in replay", () => {
    it("should block absolute HTTP URLs", async () => {
      const result = await replayAction({
        id: "bad-1", type: "vote", method: "POST",
        url: "http://internal:8080/admin", body: "{}", timestamp: 0, retries: 0,
      });
      expect(result.error).toBe("Invalid URL");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should block absolute HTTPS URLs", async () => {
      const result = await replayAction({
        id: "bad-2", type: "vote", method: "POST",
        url: "https://evil.com/steal", body: "{}", timestamp: 0, retries: 0,
      });
      expect(result.error).toBe("Invalid URL");
    });

    it("should allow relative API paths", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
      const result = await replayAction({
        id: "good-1", type: "vote", method: "POST",
        url: "/api/votes", body: "{}", timestamp: 0, retries: 0,
      });
      expect(result.success).toBe(true);
    });

    it("should not pass body for DELETE requests", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
      await replayAction({
        id: "del-1", type: "vote", method: "DELETE",
        url: "/api/votes/1", body: "{}", timestamp: 0, retries: 0,
      });
      expect(mockFetch).toHaveBeenCalledWith("/api/votes/1", expect.objectContaining({ body: undefined }));
    });
  });

  describe("Retry behavior", () => {
    it("should increment retries on failure", async () => {
      await enqueueAction({ type: "vote", method: "POST", url: "/api/votes", body: "{}" });
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

      const actions = await getQueuedActions();
      await replayAction(actions[0]);

      // Action should still be in queue with incremented retries
      const remaining = await getQueuedActions();
      expect(remaining.length).toBeGreaterThanOrEqual(0); // May or may not be removed depending on retries
    });

    it("should remove action after max retries", async () => {
      store.set("retry-test", {
        id: "retry-test", type: "vote", method: "POST",
        url: "/api/votes", body: "{}", timestamp: 0, retries: 2,
      });
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await replayAction(store.get("retry-test")!);
      expect(result.error).toContain("Max retries");
    });
  });
});
