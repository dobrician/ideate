// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProjectUpdates } from "@/lib/use-project-updates";
import type { WsClient } from "@/lib/websocket/client";
import type { WsServerMessage } from "@/lib/websocket/types";

type MessageHandler = (message: WsServerMessage) => void;

function createMockClient(): WsClient & { _handlers: Map<string, Set<MessageHandler>> } {
  const handlers = new Map<string, Set<MessageHandler>>();

  return {
    _handlers: handlers,
    state: "connected" as const,
    connect: vi.fn(),
    disconnect: vi.fn(),
    subscribe: vi.fn((channel: string, handler: MessageHandler) => {
      let set = handlers.get(channel);
      if (!set) {
        set = new Set();
        handlers.set(channel, set);
      }
      set.add(handler);
      return () => {
        set!.delete(handler);
        if (set!.size === 0) handlers.delete(channel);
      };
    }),
    unsubscribe: vi.fn(),
    sendMessage: vi.fn(),
    onStateChange: vi.fn(() => () => {}),
    onMessage: vi.fn(() => () => {}),
    updateToken: vi.fn(),
  };
}

function simulateMessage(client: ReturnType<typeof createMockClient>, channel: string, message: WsServerMessage) {
  const set = client._handlers.get(channel);
  if (set) {
    for (const handler of set) {
      handler(message);
    }
  }
}

describe("useProjectUpdates", () => {
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    client = createMockClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with empty activities and zero participants", () => {
    const { result } = renderHook(() =>
      useProjectUpdates(client, "project:p1")
    );

    expect(result.current.activities).toEqual([]);
    expect(result.current.participantCount).toBe(0);
  });

  it("subscribes to the channel on mount", () => {
    renderHook(() => useProjectUpdates(client, "project:p1"));

    expect(client.subscribe).toHaveBeenCalledWith("project:p1", expect.any(Function));
  });

  it("unsubscribes on unmount", () => {
    const { unmount } = renderHook(() =>
      useProjectUpdates(client, "project:p1")
    );

    expect(client._handlers.has("project:p1")).toBe(true);
    unmount();
    expect(client._handlers.has("project:p1")).toBe(false);
  });

  it("tracks project_update messages as activities", () => {
    const { result } = renderHook(() =>
      useProjectUpdates(client, "project:p1")
    );

    act(() => {
      simulateMessage(client, "project:p1", {
        type: "project_update",
        channel: "project:p1",
        data: {
          action: "proposal_added",
          entityId: "prop1",
          summary: "New proposal",
          userId: "u1",
          userName: "alice",
          timestamp: 1000,
        },
      });
    });

    expect(result.current.activities).toHaveLength(1);
    expect(result.current.activities[0]).toMatchObject({
      action: "proposal_added",
      entityId: "prop1",
      summary: "New proposal",
      userId: "u1",
      userName: "alice",
      timestamp: 1000,
    });
  });

  it("prepends new activities (most recent first)", () => {
    const { result } = renderHook(() =>
      useProjectUpdates(client, "project:p1")
    );

    act(() => {
      simulateMessage(client, "project:p1", {
        type: "project_update",
        channel: "project:p1",
        data: {
          action: "proposal_added",
          entityId: "prop1",
          summary: "First",
          userId: "u1",
          timestamp: 1000,
        },
      });
    });

    act(() => {
      simulateMessage(client, "project:p1", {
        type: "project_update",
        channel: "project:p1",
        data: {
          action: "vote_cast",
          entityId: "prop2",
          summary: "Vote up",
          userId: "u2",
          timestamp: 2000,
        },
      });
    });

    expect(result.current.activities).toHaveLength(2);
    expect(result.current.activities[0].summary).toBe("Vote up");
    expect(result.current.activities[1].summary).toBe("First");
  });

  it("limits activities to 20 items", () => {
    const { result } = renderHook(() =>
      useProjectUpdates(client, "project:p1")
    );

    act(() => {
      for (let i = 0; i < 25; i++) {
        simulateMessage(client, "project:p1", {
          type: "project_update",
          channel: "project:p1",
          data: {
            action: "vote_cast",
            entityId: `prop${i}`,
            summary: `Activity ${i}`,
            userId: "u1",
            timestamp: 1000 + i,
          },
        });
      }
    });

    expect(result.current.activities).toHaveLength(20);
    // Most recent should be first
    expect(result.current.activities[0].summary).toBe("Activity 24");
  });

  it("tracks presence messages for participant count", () => {
    const { result } = renderHook(() =>
      useProjectUpdates(client, "project:p1")
    );

    act(() => {
      simulateMessage(client, "project:p1", {
        type: "presence",
        channel: "project:p1",
        data: { userId: "u1", status: "online", userName: "alice" },
      });
    });

    expect(result.current.participantCount).toBe(1);

    act(() => {
      simulateMessage(client, "project:p1", {
        type: "presence",
        channel: "project:p1",
        data: { userId: "u2", status: "online", userName: "bob" },
      });
    });

    expect(result.current.participantCount).toBe(2);
  });

  it("decrements participant count on offline presence", () => {
    const { result } = renderHook(() =>
      useProjectUpdates(client, "project:p1")
    );

    act(() => {
      simulateMessage(client, "project:p1", {
        type: "presence",
        channel: "project:p1",
        data: { userId: "u1", status: "online" },
      });
      simulateMessage(client, "project:p1", {
        type: "presence",
        channel: "project:p1",
        data: { userId: "u2", status: "online" },
      });
    });

    expect(result.current.participantCount).toBe(2);

    act(() => {
      simulateMessage(client, "project:p1", {
        type: "presence",
        channel: "project:p1",
        data: { userId: "u1", status: "offline" },
      });
    });

    expect(result.current.participantCount).toBe(1);
  });

  it("handles null client gracefully", () => {
    const { result } = renderHook(() =>
      useProjectUpdates(null, "project:p1")
    );

    expect(result.current.activities).toEqual([]);
    expect(result.current.participantCount).toBe(0);
  });

  it("clears state when channel changes", () => {
    const { result, rerender } = renderHook(
      ({ channel }) => useProjectUpdates(client, channel),
      { initialProps: { channel: "project:p1" } }
    );

    act(() => {
      simulateMessage(client, "project:p1", {
        type: "presence",
        channel: "project:p1",
        data: { userId: "u1", status: "online" },
      });
    });

    expect(result.current.participantCount).toBe(1);

    rerender({ channel: "project:p2" });

    expect(result.current.participantCount).toBe(0);
  });

  it("provides clearActivities callback", () => {
    const { result } = renderHook(() =>
      useProjectUpdates(client, "project:p1")
    );

    act(() => {
      simulateMessage(client, "project:p1", {
        type: "project_update",
        channel: "project:p1",
        data: {
          action: "proposal_added",
          entityId: "prop1",
          summary: "New proposal",
          userId: "u1",
          timestamp: 1000,
        },
      });
    });

    expect(result.current.activities).toHaveLength(1);

    act(() => {
      result.current.clearActivities();
    });

    expect(result.current.activities).toEqual([]);
  });

  it("ignores messages of other types", () => {
    const { result } = renderHook(() =>
      useProjectUpdates(client, "project:p1")
    );

    act(() => {
      simulateMessage(client, "project:p1", {
        type: "vote_update",
        channel: "project:p1",
        data: { proposalId: "prop1", upvotes: 5, downvotes: 1 },
      });
    });

    expect(result.current.activities).toEqual([]);
    expect(result.current.participantCount).toBe(0);
  });
});
