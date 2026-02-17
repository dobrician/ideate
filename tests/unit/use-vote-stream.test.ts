// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── Mock EventSource ───────────────────────────────────────────

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 0;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
    this.readyState = 2;
  }

  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent("message", { data: JSON.stringify(data) }));
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror();
    }
  }
}

// ── Setup ──────────────────────────────────────────────────────

let originalEventSource: typeof EventSource;

beforeEach(() => {
  MockEventSource.instances = [];
  originalEventSource = globalThis.EventSource;
  globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
  vi.useFakeTimers();
});

afterEach(() => {
  globalThis.EventSource = originalEventSource;
  vi.useRealTimers();
});

// ── Import after mock setup ────────────────────────────────────

// We need dynamic import to get a fresh module each test
async function importHook() {
  // Clear module cache to get fresh state
  vi.resetModules();
  const mod = await import("@/lib/use-vote-stream");
  return mod.useVoteStream;
}

// ── Tests ──────────────────────────────────────────────────────

describe("useVoteStream", () => {
  it("connects to SSE endpoint with projectId", async () => {
    const useVoteStream = await importHook();
    renderHook(() => useVoteStream("proj-123"));

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe("/api/votes/stream?projectId=proj-123");
  });

  it("returns empty map initially", async () => {
    const useVoteStream = await importHook();
    const { result } = renderHook(() => useVoteStream("proj-1"));

    expect(result.current.size).toBe(0);
  });

  it("updates map when receiving SSE message", async () => {
    const useVoteStream = await importHook();
    const { result } = renderHook(() => useVoteStream("proj-1"));

    const es = MockEventSource.instances[0];
    act(() => {
      es.simulateMessage({ proposalId: "p1", upvotes: 5, downvotes: 2 });
    });

    expect(result.current.get("p1")).toEqual({
      proposalId: "p1",
      upvotes: 5,
      downvotes: 2,
    });
  });

  it("accumulates updates for multiple proposals", async () => {
    const useVoteStream = await importHook();
    const { result } = renderHook(() => useVoteStream("proj-1"));

    const es = MockEventSource.instances[0];
    act(() => {
      es.simulateMessage({ proposalId: "p1", upvotes: 3, downvotes: 1 });
      es.simulateMessage({ proposalId: "p2", upvotes: 7, downvotes: 0 });
    });

    expect(result.current.size).toBe(2);
    expect(result.current.get("p1")?.upvotes).toBe(3);
    expect(result.current.get("p2")?.upvotes).toBe(7);
  });

  it("overwrites previous value for same proposal", async () => {
    const useVoteStream = await importHook();
    const { result } = renderHook(() => useVoteStream("proj-1"));

    const es = MockEventSource.instances[0];
    act(() => {
      es.simulateMessage({ proposalId: "p1", upvotes: 3, downvotes: 1 });
    });
    act(() => {
      es.simulateMessage({ proposalId: "p1", upvotes: 4, downvotes: 1 });
    });

    expect(result.current.get("p1")?.upvotes).toBe(4);
  });

  it("ignores invalid JSON messages", async () => {
    const useVoteStream = await importHook();
    const { result } = renderHook(() => useVoteStream("proj-1"));

    const es = MockEventSource.instances[0];
    // Send raw invalid data (not going through simulateMessage which auto-JSONifies)
    act(() => {
      if (es.onmessage) {
        es.onmessage(new MessageEvent("message", { data: "not json" }));
      }
    });

    expect(result.current.size).toBe(0);
  });

  it("reconnects with exponential backoff on error", async () => {
    const useVoteStream = await importHook();
    renderHook(() => useVoteStream("proj-1"));

    const es1 = MockEventSource.instances[0];

    // First error — should reconnect after 1s (BACKOFF_INITIAL_MS)
    act(() => {
      es1.simulateError();
    });
    expect(MockEventSource.instances).toHaveLength(1); // original closed, no new yet

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(MockEventSource.instances).toHaveLength(2); // reconnected

    // Second error — should reconnect after 2s
    const es2 = MockEventSource.instances[1];
    act(() => {
      es2.simulateError();
    });

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(MockEventSource.instances).toHaveLength(2); // not yet

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(MockEventSource.instances).toHaveLength(3); // reconnected at 2s
  });

  it("resets backoff on successful message", async () => {
    const useVoteStream = await importHook();
    renderHook(() => useVoteStream("proj-1"));

    const es1 = MockEventSource.instances[0];

    // Trigger error to increase backoff to 2s
    act(() => {
      es1.simulateError();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const es2 = MockEventSource.instances[1];
    // Successful message resets backoff
    act(() => {
      es2.simulateMessage({ proposalId: "p1", upvotes: 1, downvotes: 0 });
    });

    // Next error should reconnect after 1s (reset), not 2s
    act(() => {
      es2.simulateError();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(MockEventSource.instances).toHaveLength(3); // reconnected at 1s
  });

  it("closes EventSource on unmount", async () => {
    const useVoteStream = await importHook();
    const { unmount } = renderHook(() => useVoteStream("proj-1"));

    const es = MockEventSource.instances[0];
    expect(es.closed).toBe(false);

    unmount();
    expect(es.closed).toBe(true);
  });

  it("clears reconnect timer on unmount", async () => {
    const useVoteStream = await importHook();
    const { unmount } = renderHook(() => useVoteStream("proj-1"));

    const es = MockEventSource.instances[0];
    act(() => {
      es.simulateError();
    });

    // Unmount before reconnect timer fires
    unmount();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Should not have reconnected
    expect(MockEventSource.instances).toHaveLength(1);
  });
});
