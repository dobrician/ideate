import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => []),
      })),
    })),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/integrations/slack", () => ({
  sendSlackMessage: vi.fn(() => Promise.resolve({ ok: true, status: 200, body: "ok" })),
  formatSlackPayload: vi.fn(() => ({ text: "test", blocks: [] })),
}));

vi.mock("@/lib/integrations/teams", () => ({
  sendTeamsMessage: vi.fn(() => Promise.resolve({ ok: true, status: 200, body: "ok" })),
  formatTeamsCard: vi.fn(() => ({ type: "message", attachments: [] })),
}));

vi.mock("@/lib/integrations/discord", () => ({
  sendDiscordMessage: vi.fn(() => Promise.resolve({ ok: true, status: 200, body: "ok" })),
  formatDiscordPayload: vi.fn(() => ({ content: "test", embeds: [] })),
}));

// Must import after mocks
import { matchesEventFilter } from "@/lib/webhooks";

describe("Integration Dispatch Helpers", () => {
  describe("matchesEventFilter for integrations", () => {
    it("should match wildcard pattern for all events", () => {
      expect(matchesEventFilter("project.created", ["*"])).toBe(true);
    });

    it("should match category wildcards", () => {
      expect(matchesEventFilter("proposal.created", ["proposal.*"])).toBe(true);
      expect(matchesEventFilter("proposal.updated", ["proposal.*"])).toBe(true);
    });

    it("should handle multiple filter patterns", () => {
      const patterns = ["project.*", "vote.cast"];
      expect(matchesEventFilter("project.created", patterns)).toBe(true);
      expect(matchesEventFilter("vote.cast", patterns)).toBe(true);
      expect(matchesEventFilter("comment.created", patterns)).toBe(false);
    });
  });
});
