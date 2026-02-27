import { describe, it, expect, vi } from "vitest";
import { formatSlackPayload } from "@/lib/integrations/slack";
import type { WebhookEvent } from "@/lib/webhooks";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("Slack Integration", () => {
  const event: WebhookEvent = "project.created";
  const data = {
    title: "Test Project",
    projectTitle: "Parent Project",
    userName: "John Doe",
    description: "A test project description",
  };

  describe("formatSlackPayload", () => {
    it("should return text fallback and blocks array", () => {
      const result = formatSlackPayload(event, data);
      expect(result.text).toBeDefined();
      expect(result.blocks).toBeDefined();
      expect(Array.isArray(result.blocks)).toBe(true);
    });

    it("should include a header block", () => {
      const result = formatSlackPayload(event, data);
      const header = result.blocks.find((b) => b.type === "header");
      expect(header).toBeDefined();
      expect(header?.text?.type).toBe("plain_text");
    });

    it("should include a section block with title", () => {
      const result = formatSlackPayload(event, data);
      const sections = result.blocks.filter((b) => b.type === "section");
      expect(sections.length).toBeGreaterThan(0);
    });

    it("should include fields for project, user data", () => {
      const result = formatSlackPayload(event, data);
      const fieldSection = result.blocks.find((b) => b.fields);
      expect(fieldSection).toBeDefined();
      const fieldTexts = fieldSection?.fields?.map((f) => f.text) ?? [];
      expect(fieldTexts.some((t) => t.includes("Parent Project"))).toBe(true);
      expect(fieldTexts.some((t) => t.includes("John Doe"))).toBe(true);
    });

    it("should include a context block with timestamp", () => {
      const result = formatSlackPayload(event, data);
      const context = result.blocks.find((b) => b.type === "context");
      expect(context).toBeDefined();
    });

    it("should handle minimal data", () => {
      const result = formatSlackPayload("vote.cast", {});
      expect(result.text).toContain("vote.cast");
      expect(result.blocks.length).toBeGreaterThan(0);
    });

    it("should truncate long descriptions", () => {
      const longData = { description: "x".repeat(500) };
      const result = formatSlackPayload(event, longData);
      const fieldSection = result.blocks.find((b) => b.fields);
      if (fieldSection?.fields) {
        const descField = fieldSection.fields.find((f) => f.text.includes("Description"));
        if (descField) {
          expect(descField.text.length).toBeLessThan(500);
        }
      }
    });

    it("should handle all event types", () => {
      const events: WebhookEvent[] = [
        "project.created", "project.updated", "project.archived", "project.deadline",
        "proposal.created", "proposal.updated", "proposal.status_changed",
        "vote.cast", "comment.created", "user.joined", "workflow.stage_changed",
        "integration.test",
      ];
      for (const ev of events) {
        const result = formatSlackPayload(ev, { title: "Test" });
        expect(result.blocks.length).toBeGreaterThan(0);
      }
    });
  });
});
