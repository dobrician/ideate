import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database before importing
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => []), orderBy: vi.fn(() => ({ limit: vi.fn(() => []) })) })) })) })),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => []) })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({})) })) })),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })) },
}));

import {
  signPayload,
  matchesEventFilter,
  formatPayload,
  computeRetryDelay,
  ALL_WEBHOOK_EVENTS,
  type WebhookEvent,
  type RetryConfig,
  type PayloadTemplate,
} from "@/lib/webhooks";

describe("Advanced Webhook Features", () => {
  describe("ALL_WEBHOOK_EVENTS", () => {
    it("should contain 12 event types", () => {
      expect(ALL_WEBHOOK_EVENTS).toHaveLength(12);
    });

    it("should include all expected events", () => {
      expect(ALL_WEBHOOK_EVENTS).toContain("project.created");
      expect(ALL_WEBHOOK_EVENTS).toContain("project.updated");
      expect(ALL_WEBHOOK_EVENTS).toContain("project.archived");
      expect(ALL_WEBHOOK_EVENTS).toContain("project.deadline");
      expect(ALL_WEBHOOK_EVENTS).toContain("proposal.created");
      expect(ALL_WEBHOOK_EVENTS).toContain("proposal.updated");
      expect(ALL_WEBHOOK_EVENTS).toContain("proposal.status_changed");
      expect(ALL_WEBHOOK_EVENTS).toContain("vote.cast");
      expect(ALL_WEBHOOK_EVENTS).toContain("comment.created");
      expect(ALL_WEBHOOK_EVENTS).toContain("user.joined");
      expect(ALL_WEBHOOK_EVENTS).toContain("workflow.stage_changed");
      expect(ALL_WEBHOOK_EVENTS).toContain("integration.test");
    });
  });

  describe("signPayload", () => {
    it("should produce consistent HMAC-SHA256 signatures", () => {
      const sig1 = signPayload("test", "secret");
      const sig2 = signPayload("test", "secret");
      expect(sig1).toBe(sig2);
    });

    it("should produce different signatures for different payloads", () => {
      const sig1 = signPayload("test1", "secret");
      const sig2 = signPayload("test2", "secret");
      expect(sig1).not.toBe(sig2);
    });

    it("should produce different signatures for different secrets", () => {
      const sig1 = signPayload("test", "secret1");
      const sig2 = signPayload("test", "secret2");
      expect(sig1).not.toBe(sig2);
    });

    it("should return a hex string", () => {
      const sig = signPayload("test", "secret");
      expect(sig).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe("matchesEventFilter", () => {
    it("should match exact events", () => {
      expect(matchesEventFilter("project.created", ["project.created"])).toBe(true);
    });

    it("should not match different events", () => {
      expect(matchesEventFilter("project.created", ["proposal.created"])).toBe(false);
    });

    it("should match wildcard * pattern", () => {
      expect(matchesEventFilter("project.created", ["*"])).toBe(true);
      expect(matchesEventFilter("vote.cast", ["*"])).toBe(true);
    });

    it("should match prefix wildcard patterns", () => {
      expect(matchesEventFilter("project.created", ["project.*"])).toBe(true);
      expect(matchesEventFilter("project.updated", ["project.*"])).toBe(true);
      expect(matchesEventFilter("project.archived", ["project.*"])).toBe(true);
    });

    it("should not match unrelated prefix wildcards", () => {
      expect(matchesEventFilter("vote.cast", ["project.*"])).toBe(false);
      expect(matchesEventFilter("comment.created", ["project.*"])).toBe(false);
    });

    it("should match when any pattern matches", () => {
      expect(matchesEventFilter("vote.cast", ["project.*", "vote.cast"])).toBe(true);
    });

    it("should not match empty patterns", () => {
      expect(matchesEventFilter("project.created", [])).toBe(false);
    });
  });

  describe("computeRetryDelay", () => {
    it("should compute exponential backoff", () => {
      const config: RetryConfig = { strategy: "exponential", maxAttempts: 3, baseDelayMs: 1000 };
      expect(computeRetryDelay(config, 1)).toBe(1000);
      expect(computeRetryDelay(config, 2)).toBe(2000);
      expect(computeRetryDelay(config, 3)).toBe(4000);
    });

    it("should compute linear backoff", () => {
      const config: RetryConfig = { strategy: "linear", maxAttempts: 3, baseDelayMs: 1000 };
      expect(computeRetryDelay(config, 1)).toBe(1000);
      expect(computeRetryDelay(config, 2)).toBe(2000);
      expect(computeRetryDelay(config, 3)).toBe(3000);
    });

    it("should compute fixed delay", () => {
      const config: RetryConfig = { strategy: "fixed", maxAttempts: 3, baseDelayMs: 2000 };
      expect(computeRetryDelay(config, 1)).toBe(2000);
      expect(computeRetryDelay(config, 2)).toBe(2000);
      expect(computeRetryDelay(config, 3)).toBe(2000);
    });

    it("should default to exponential for unknown strategy", () => {
      const config = { strategy: "unknown" as RetryConfig["strategy"], maxAttempts: 3, baseDelayMs: 1000 };
      expect(computeRetryDelay(config, 2)).toBe(2000);
    });
  });

  describe("formatPayload", () => {
    const event: WebhookEvent = "project.created";
    const data = { title: "Test Project", id: "123" };

    it("should format default payload as JSON with event, data, timestamp", () => {
      const result = formatPayload(event, data);
      const parsed = JSON.parse(result);
      expect(parsed.event).toBe("project.created");
      expect(parsed.data).toEqual(data);
      expect(parsed.timestamp).toBeDefined();
    });

    it("should format default payload when no template provided", () => {
      const result = formatPayload(event, data, undefined);
      const parsed = JSON.parse(result);
      expect(parsed.event).toBe("project.created");
    });

    it("should format default payload for default template", () => {
      const template: PayloadTemplate = { format: "default" };
      const result = formatPayload(event, data, template);
      const parsed = JSON.parse(result);
      expect(parsed.event).toBe("project.created");
    });

    it("should apply custom template with placeholders", () => {
      const template: PayloadTemplate = {
        format: "custom",
        customTemplate: '{"type":"{{event}}","time":"{{timestamp}}","info":{{data}}}',
      };
      const result = formatPayload(event, data, template);
      const parsed = JSON.parse(result);
      expect(parsed.type).toBe("project.created");
      expect(parsed.time).toBeDefined();
      expect(parsed.info).toEqual(data);
    });

    it("should fall back to default for invalid custom template", () => {
      const template: PayloadTemplate = {
        format: "custom",
        customTemplate: "not valid json {{{",
      };
      const result = formatPayload(event, data, template);
      const parsed = JSON.parse(result);
      expect(parsed.event).toBe("project.created");
    });

    it("should fall back to default for custom format without template", () => {
      const template: PayloadTemplate = { format: "custom" };
      const result = formatPayload(event, data, template);
      const parsed = JSON.parse(result);
      expect(parsed.event).toBe("project.created");
    });

    it("should return default for platform-specific formats", () => {
      const template: PayloadTemplate = { format: "slack" };
      const result = formatPayload(event, data, template);
      const parsed = JSON.parse(result);
      expect(parsed.event).toBe("project.created");
    });
  });
});
