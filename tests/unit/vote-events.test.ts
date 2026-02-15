/**
 * Unit tests for vote event emitter (src/lib/vote-events.ts).
 *
 * Covers:
 *  - subscribeVotes returns an unsubscribe function
 *  - emitVoteChange calls all listeners for the project
 *  - emitVoteChange does not call listeners for other projects
 *  - Unsubscribing removes the listener
 *  - Multiple listeners for the same project all receive events
 *  - Listener errors do not break the emitter
 *  - Cleanup of empty listener sets
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { VoteEvent } from "@/lib/vote-events";

/**
 * We use dynamic import + vi.resetModules so each test group gets a fresh
 * module instance with a clean listeners map. This prevents state leaking
 * between describe blocks.
 */
async function loadVoteEvents() {
  vi.resetModules();
  const mod = await import("@/lib/vote-events");
  return {
    subscribeVotes: mod.subscribeVotes,
    emitVoteChange: mod.emitVoteChange,
  };
}

function makeEvent(overrides: Partial<VoteEvent> = {}): VoteEvent {
  return {
    proposalId: "proposal-1",
    projectId: "project-1",
    upvotes: 5,
    downvotes: 2,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// subscribeVotes
// ---------------------------------------------------------------------------

describe("subscribeVotes", () => {
  it("should return an unsubscribe function", async () => {
    const { subscribeVotes } = await loadVoteEvents();
    const listener = vi.fn<(data: VoteEvent) => void>();

    const unsubscribe = subscribeVotes("project-1", listener);

    expect(typeof unsubscribe).toBe("function");
  });

  it("should accept a listener and register it for the given project", async () => {
    const { subscribeVotes, emitVoteChange } = await loadVoteEvents();
    const listener = vi.fn<(data: VoteEvent) => void>();

    subscribeVotes("project-1", listener);
    emitVoteChange(makeEvent());

    expect(listener).toHaveBeenCalledOnce();
  });

  it("should allow subscribing multiple listeners for the same project", async () => {
    const { subscribeVotes, emitVoteChange } = await loadVoteEvents();
    const listener1 = vi.fn<(data: VoteEvent) => void>();
    const listener2 = vi.fn<(data: VoteEvent) => void>();
    const listener3 = vi.fn<(data: VoteEvent) => void>();

    subscribeVotes("project-1", listener1);
    subscribeVotes("project-1", listener2);
    subscribeVotes("project-1", listener3);

    emitVoteChange(makeEvent());

    expect(listener1).toHaveBeenCalledOnce();
    expect(listener2).toHaveBeenCalledOnce();
    expect(listener3).toHaveBeenCalledOnce();
  });

  it("should allow subscribing to different projects independently", async () => {
    const { subscribeVotes, emitVoteChange } = await loadVoteEvents();
    const listenerA = vi.fn<(data: VoteEvent) => void>();
    const listenerB = vi.fn<(data: VoteEvent) => void>();

    subscribeVotes("project-A", listenerA);
    subscribeVotes("project-B", listenerB);

    emitVoteChange(makeEvent({ projectId: "project-A" }));

    expect(listenerA).toHaveBeenCalledOnce();
    expect(listenerB).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// emitVoteChange
// ---------------------------------------------------------------------------

describe("emitVoteChange", () => {
  it("should call all listeners for the matching project", async () => {
    const { subscribeVotes, emitVoteChange } = await loadVoteEvents();
    const listener1 = vi.fn<(data: VoteEvent) => void>();
    const listener2 = vi.fn<(data: VoteEvent) => void>();

    subscribeVotes("project-1", listener1);
    subscribeVotes("project-1", listener2);

    const event = makeEvent({ upvotes: 10, downvotes: 3 });
    emitVoteChange(event);

    expect(listener1).toHaveBeenCalledWith(event);
    expect(listener2).toHaveBeenCalledWith(event);
  });

  it("should NOT call listeners for other projects", async () => {
    const { subscribeVotes, emitVoteChange } = await loadVoteEvents();
    const listenerProject1 = vi.fn<(data: VoteEvent) => void>();
    const listenerProject2 = vi.fn<(data: VoteEvent) => void>();

    subscribeVotes("project-1", listenerProject1);
    subscribeVotes("project-2", listenerProject2);

    emitVoteChange(makeEvent({ projectId: "project-1" }));

    expect(listenerProject1).toHaveBeenCalledOnce();
    expect(listenerProject2).not.toHaveBeenCalled();
  });

  it("should pass the full VoteEvent to each listener", async () => {
    const { subscribeVotes, emitVoteChange } = await loadVoteEvents();
    const listener = vi.fn<(data: VoteEvent) => void>();

    subscribeVotes("project-1", listener);

    const event: VoteEvent = {
      proposalId: "proposal-42",
      projectId: "project-1",
      upvotes: 99,
      downvotes: 7,
    };
    emitVoteChange(event);

    expect(listener).toHaveBeenCalledWith(event);
    const received = listener.mock.calls[0][0];
    expect(received.proposalId).toBe("proposal-42");
    expect(received.projectId).toBe("project-1");
    expect(received.upvotes).toBe(99);
    expect(received.downvotes).toBe(7);
  });

  it("should do nothing when there are no listeners for the project", async () => {
    const { emitVoteChange } = await loadVoteEvents();

    // Should not throw
    expect(() => {
      emitVoteChange(makeEvent({ projectId: "no-listeners" }));
    }).not.toThrow();
  });

  it("should handle emitting to a project with no subscriptions gracefully", async () => {
    const { subscribeVotes, emitVoteChange } = await loadVoteEvents();
    const listener = vi.fn<(data: VoteEvent) => void>();

    // Subscribe to project-1, but emit for project-2
    subscribeVotes("project-1", listener);
    emitVoteChange(makeEvent({ projectId: "project-2" }));

    expect(listener).not.toHaveBeenCalled();
  });

  it("should continue calling remaining listeners even if one throws", async () => {
    const { subscribeVotes, emitVoteChange } = await loadVoteEvents();
    const throwingListener = vi.fn<(data: VoteEvent) => void>().mockImplementation(() => {
      throw new Error("listener error");
    });
    const normalListener = vi.fn<(data: VoteEvent) => void>();

    subscribeVotes("project-1", throwingListener);
    subscribeVotes("project-1", normalListener);

    expect(() => {
      emitVoteChange(makeEvent());
    }).not.toThrow();

    expect(throwingListener).toHaveBeenCalledOnce();
    expect(normalListener).toHaveBeenCalledOnce();
  });

  it("should emit multiple events independently", async () => {
    const { subscribeVotes, emitVoteChange } = await loadVoteEvents();
    const listener = vi.fn<(data: VoteEvent) => void>();

    subscribeVotes("project-1", listener);

    const event1 = makeEvent({ upvotes: 1 });
    const event2 = makeEvent({ upvotes: 2 });
    const event3 = makeEvent({ upvotes: 3 });

    emitVoteChange(event1);
    emitVoteChange(event2);
    emitVoteChange(event3);

    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener.mock.calls[0][0].upvotes).toBe(1);
    expect(listener.mock.calls[1][0].upvotes).toBe(2);
    expect(listener.mock.calls[2][0].upvotes).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Unsubscribe behavior
// ---------------------------------------------------------------------------

describe("unsubscribe", () => {
  it("should remove the listener so it no longer receives events", async () => {
    const { subscribeVotes, emitVoteChange } = await loadVoteEvents();
    const listener = vi.fn<(data: VoteEvent) => void>();

    const unsubscribe = subscribeVotes("project-1", listener);

    // Emit before unsubscribe - listener should be called
    emitVoteChange(makeEvent());
    expect(listener).toHaveBeenCalledOnce();

    // Unsubscribe
    unsubscribe();

    // Emit after unsubscribe - listener should NOT be called again
    emitVoteChange(makeEvent({ upvotes: 99 }));
    expect(listener).toHaveBeenCalledOnce(); // still 1
  });

  it("should only remove the specific listener, not others for the same project", async () => {
    const { subscribeVotes, emitVoteChange } = await loadVoteEvents();
    const listener1 = vi.fn<(data: VoteEvent) => void>();
    const listener2 = vi.fn<(data: VoteEvent) => void>();

    const unsub1 = subscribeVotes("project-1", listener1);
    subscribeVotes("project-1", listener2);

    unsub1();

    emitVoteChange(makeEvent());

    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).toHaveBeenCalledOnce();
  });

  it("should clean up the project entry when the last listener unsubscribes", async () => {
    const { subscribeVotes, emitVoteChange } = await loadVoteEvents();
    const listener = vi.fn<(data: VoteEvent) => void>();

    const unsub = subscribeVotes("project-1", listener);
    unsub();

    // Emitting should do nothing (no listeners, no error)
    expect(() => {
      emitVoteChange(makeEvent());
    }).not.toThrow();

    expect(listener).not.toHaveBeenCalled();
  });

  it("should be safe to call unsubscribe multiple times", async () => {
    const { subscribeVotes, emitVoteChange } = await loadVoteEvents();
    const listener = vi.fn<(data: VoteEvent) => void>();

    const unsub = subscribeVotes("project-1", listener);

    unsub();
    // Calling again should not throw
    expect(() => unsub()).not.toThrow();

    emitVoteChange(makeEvent());
    expect(listener).not.toHaveBeenCalled();
  });

  it("should not affect listeners on other projects when unsubscribing", async () => {
    const { subscribeVotes, emitVoteChange } = await loadVoteEvents();
    const listenerA = vi.fn<(data: VoteEvent) => void>();
    const listenerB = vi.fn<(data: VoteEvent) => void>();

    const unsubA = subscribeVotes("project-A", listenerA);
    subscribeVotes("project-B", listenerB);

    unsubA();

    emitVoteChange(makeEvent({ projectId: "project-B" }));

    expect(listenerA).not.toHaveBeenCalled();
    expect(listenerB).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Multiple listeners for the same project
// ---------------------------------------------------------------------------

describe("multiple listeners for same project", () => {
  it("should deliver the same event to all listeners", async () => {
    const { subscribeVotes, emitVoteChange } = await loadVoteEvents();
    const listeners = Array.from({ length: 5 }, () =>
      vi.fn<(data: VoteEvent) => void>()
    );

    for (const listener of listeners) {
      subscribeVotes("project-1", listener);
    }

    const event = makeEvent({ proposalId: "p-shared", upvotes: 42 });
    emitVoteChange(event);

    for (const listener of listeners) {
      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(event);
    }
  });

  it("should handle interleaved subscribe and unsubscribe correctly", async () => {
    const { subscribeVotes, emitVoteChange } = await loadVoteEvents();
    const listener1 = vi.fn<(data: VoteEvent) => void>();
    const listener2 = vi.fn<(data: VoteEvent) => void>();
    const listener3 = vi.fn<(data: VoteEvent) => void>();

    const unsub1 = subscribeVotes("project-1", listener1);
    subscribeVotes("project-1", listener2);
    unsub1(); // Remove listener1
    subscribeVotes("project-1", listener3); // Add listener3

    emitVoteChange(makeEvent());

    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).toHaveBeenCalledOnce();
    expect(listener3).toHaveBeenCalledOnce();
  });
});
