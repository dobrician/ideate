import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/websocket/server", () => ({
  publishToChannel: vi.fn(),
}));

import { emitProjectEvent } from "@/lib/project-events";
import { publishToChannel } from "@/lib/websocket/server";

describe("project-events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes a project_update message to the correct channel", () => {
    emitProjectEvent({
      projectId: "p1",
      action: "proposal_added",
      entityId: "prop1",
      summary: "New proposal title",
      userId: "u1",
      userName: "alice",
    });

    expect(publishToChannel).toHaveBeenCalledOnce();
    const [channel, message] = (publishToChannel as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(channel).toBe("project:p1");
    expect(message).toMatchObject({
      type: "project_update",
      channel: "project:p1",
      data: {
        action: "proposal_added",
        entityId: "prop1",
        summary: "New proposal title",
        userId: "u1",
        userName: "alice",
      },
    });
    expect(typeof message.data.timestamp).toBe("number");
  });

  it("supports all action types", () => {
    const actions = ["proposal_added", "proposal_deleted", "status_changed", "vote_cast"] as const;

    for (const action of actions) {
      vi.clearAllMocks();
      emitProjectEvent({
        projectId: "p2",
        action,
        entityId: "e1",
        summary: `Test ${action}`,
        userId: "u1",
      });
      expect(publishToChannel).toHaveBeenCalledOnce();
      const msg = (publishToChannel as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(msg.data.action).toBe(action);
    }
  });

  it("does not throw when publishToChannel fails", () => {
    (publishToChannel as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("WS not initialized");
    });

    expect(() =>
      emitProjectEvent({
        projectId: "p3",
        action: "vote_cast",
        entityId: "prop1",
        summary: "Vote up",
        userId: "u1",
      })
    ).not.toThrow();
  });

  it("omits userName when not provided", () => {
    emitProjectEvent({
      projectId: "p4",
      action: "status_changed",
      entityId: "p4",
      summary: "Status changed to archived",
      userId: "u1",
    });

    const msg = (publishToChannel as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(msg.data.userName).toBeUndefined();
  });
});
