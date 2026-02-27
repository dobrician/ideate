import { describe, it, expect, vi } from "vitest";
import { formatDiscordPayload } from "@/lib/integrations/discord";
import type { WebhookEvent } from "@/lib/webhooks";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("Discord Integration", () => {
  const event: WebhookEvent = "vote.cast";
  const data = {
    title: "Vote on Proposal A",
    projectTitle: "Project Beta",
    userName: "Bob",
    status: "active",
    description: "User voted on proposal",
  };

  describe("formatDiscordPayload", () => {
    it("should return content string and embeds array", () => {
      const result = formatDiscordPayload(event, data);
      expect(result.content).toBeDefined();
      expect(result.embeds).toBeDefined();
      expect(Array.isArray(result.embeds)).toBe(true);
      expect(result.embeds).toHaveLength(1);
    });

    it("should include event in content", () => {
      const result = formatDiscordPayload(event, data);
      expect(result.content).toContain("vote.cast");
    });

    it("should set embed title to event name", () => {
      const result = formatDiscordPayload(event, data);
      expect(result.embeds[0].title).toContain("VOTE CAST");
    });

    it("should include color as number", () => {
      const result = formatDiscordPayload(event, data);
      expect(typeof result.embeds[0].color).toBe("number");
    });

    it("should include fields for project/user data", () => {
      const result = formatDiscordPayload(event, data);
      const fields = result.embeds[0].fields;
      expect(fields).toBeDefined();
      expect(fields?.some((f) => f.value === "Project Beta")).toBe(true);
      expect(fields?.some((f) => f.value === "Bob")).toBe(true);
    });

    it("should include footer and timestamp", () => {
      const result = formatDiscordPayload(event, data);
      expect(result.embeds[0].footer?.text).toBe("Ideate Notifications");
      expect(result.embeds[0].timestamp).toBeDefined();
    });

    it("should handle minimal data without fields", () => {
      const result = formatDiscordPayload("integration.test", {});
      expect(result.embeds[0].fields).toBeUndefined();
    });

    it("should include description in embed description", () => {
      const result = formatDiscordPayload(event, data);
      expect(result.embeds[0].description).toContain("User voted on proposal");
    });

    it("should truncate long descriptions", () => {
      const longData = { title: "Title", description: "z".repeat(500) };
      const result = formatDiscordPayload(event, longData);
      expect(result.embeds[0].description!.length).toBeLessThan(500);
    });

    it("should use different colors for different events", () => {
      const r1 = formatDiscordPayload("project.created", {});
      const r2 = formatDiscordPayload("vote.cast", {});
      expect(r1.embeds[0].color).not.toBe(r2.embeds[0].color);
    });

    it("should handle all event types", () => {
      const events: WebhookEvent[] = [
        "project.created", "project.updated", "project.archived", "project.deadline",
        "proposal.created", "proposal.updated", "proposal.status_changed",
        "vote.cast", "comment.created", "user.joined", "workflow.stage_changed",
        "integration.test",
      ];
      for (const ev of events) {
        const result = formatDiscordPayload(ev, { title: "Test" });
        expect(result.embeds.length).toBe(1);
      }
    });
  });
});
