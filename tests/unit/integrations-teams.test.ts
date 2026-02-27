import { describe, it, expect, vi } from "vitest";
import { formatTeamsCard } from "@/lib/integrations/teams";
import type { WebhookEvent } from "@/lib/webhooks";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("Teams Integration", () => {
  const event: WebhookEvent = "proposal.created";
  const data = {
    title: "New Proposal",
    projectTitle: "Project Alpha",
    userName: "Jane Smith",
    status: "active",
    description: "Detailed proposal description",
  };

  describe("formatTeamsCard", () => {
    it("should return a message with adaptive card attachment", () => {
      const result = formatTeamsCard(event, data);
      expect(result.type).toBe("message");
      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0].contentType).toBe("application/vnd.microsoft.card.adaptive");
    });

    it("should include card schema and version", () => {
      const result = formatTeamsCard(event, data);
      const content = result.attachments[0].content;
      expect(content.$schema).toContain("adaptivecards.io");
      expect(content.type).toBe("AdaptiveCard");
      expect(content.version).toBe("1.4");
    });

    it("should include title block", () => {
      const result = formatTeamsCard(event, data);
      const body = result.attachments[0].content.body;
      const titleBlock = body.find((b: Record<string, unknown>) => b.weight === "Bolder");
      expect(titleBlock).toBeDefined();
    });

    it("should include FactSet with project/user data", () => {
      const result = formatTeamsCard(event, data);
      const body = result.attachments[0].content.body;
      const factSet = body.find((b: Record<string, unknown>) => b.type === "FactSet") as { facts: Array<{ title: string; value: string }> } | undefined;
      expect(factSet).toBeDefined();
      expect(factSet?.facts?.some((f) => f.value === "Project Alpha")).toBe(true);
      expect(factSet?.facts?.some((f) => f.value === "Jane Smith")).toBe(true);
    });

    it("should include description as subtle text", () => {
      const result = formatTeamsCard(event, data);
      const body = result.attachments[0].content.body;
      const descBlock = body.find((b: Record<string, unknown>) => b.isSubtle === true);
      expect(descBlock).toBeDefined();
    });

    it("should handle minimal data", () => {
      const result = formatTeamsCard("vote.cast", {});
      expect(result.attachments[0].content.body.length).toBeGreaterThan(0);
    });

    it("should truncate long descriptions to 300 chars", () => {
      const longData = { description: "y".repeat(500) };
      const result = formatTeamsCard(event, longData);
      const body = result.attachments[0].content.body;
      const descBlock = body.find((b: Record<string, unknown>) => b.isSubtle === true);
      if (descBlock) {
        expect(String(descBlock.text).length).toBeLessThanOrEqual(300);
      }
    });

    it("should handle all event types", () => {
      const events: WebhookEvent[] = [
        "project.created", "project.updated", "project.archived",
        "proposal.created", "vote.cast", "comment.created",
        "user.joined", "integration.test",
      ];
      for (const ev of events) {
        const result = formatTeamsCard(ev, { title: "Test" });
        expect(result.attachments.length).toBe(1);
      }
    });
  });
});
