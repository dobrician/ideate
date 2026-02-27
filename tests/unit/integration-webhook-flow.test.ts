import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock all external dependencies ─────────────────────────────────────

const mockFrom = vi.fn();
const mockValues = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: () => ({ from: mockFrom }),
    insert: () => ({ values: mockValues }),
    update: () => ({ set: mockSet }),
  },
}));

vi.mock("@/db/schema", () => ({
  webhooks: {},
  webhookDeliveries: {},
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  signPayload,
  verifyWebhookSignature,
  matchesEventFilter,
  formatPayload,
  fireWebhookEvent,
  deliverWebhook,
  computeRetryDelay,
  type RetryConfig,
} from "@/lib/webhooks";
import { logger } from "@/lib/logger";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
  mockValues.mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: "d1" }]) });
  mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  mockFetch.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve("OK") });
});

// ─── End-to-end webhook delivery flow tests ─────────────────────────────

describe("Integration: Webhook Event Flow", () => {
  describe("Event → Match → Deliver pipeline", () => {
    it("should skip delivery when no active webhooks exist", async () => {
      mockFrom.mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
      await fireWebhookEvent("project.created", { title: "Test" });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should skip delivery when no webhooks match the event", async () => {
      mockFrom.mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: "wh1", url: "https://example.com/hook", secret: "s", events: '["vote.cast"]', active: true, retryConfig: null, payloadTemplate: null },
        ]),
      });
      await fireWebhookEvent("project.created", { title: "Test" });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should deliver to matching webhooks", async () => {
      mockFrom.mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: "wh1", url: "https://example.com/hook", secret: "secret", events: '["project.created"]', active: true, retryConfig: null, payloadTemplate: null },
        ]),
      });

      await fireWebhookEvent("project.created", { title: "New Project" });
      // Delivery is fire-and-forget, but DB insert should happen
      expect(mockValues).toHaveBeenCalled();
    });

    it("should deliver to multiple matching webhooks", async () => {
      mockFrom.mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: "wh1", url: "https://a.com/hook", secret: "s1", events: '["project.*"]', active: true, retryConfig: null, payloadTemplate: null },
          { id: "wh2", url: "https://b.com/hook", secret: "s2", events: '["*"]', active: true, retryConfig: null, payloadTemplate: null },
        ]),
      });

      await fireWebhookEvent("project.created", { title: "Test" });
      expect(mockValues).toHaveBeenCalledTimes(2);
    });
  });

  describe("Signature integrity", () => {
    it("should produce consistent signatures for same input", () => {
      const sig1 = signPayload("data", "secret");
      const sig2 = signPayload("data", "secret");
      expect(sig1).toBe(sig2);
    });

    it("should produce different signatures for different secrets", () => {
      const sig1 = signPayload("data", "secret1");
      const sig2 = signPayload("data", "secret2");
      expect(sig1).not.toBe(sig2);
    });

    it("should roundtrip sign + verify successfully", () => {
      const payload = '{"event":"vote.cast","data":{"value":1}}';
      const sig = signPayload(payload, "my-secret");
      expect(verifyWebhookSignature(payload, `sha256=${sig}`, "my-secret")).toBe(true);
    });

    it("should fail verify with wrong secret", () => {
      const sig = signPayload("data", "correct-secret");
      expect(verifyWebhookSignature("data", `sha256=${sig}`, "wrong-secret")).toBe(false);
    });
  });

  describe("Event pattern matching integration", () => {
    it("should match exact events", () => {
      expect(matchesEventFilter("project.created", ["project.created"])).toBe(true);
      expect(matchesEventFilter("project.updated", ["project.created"])).toBe(false);
    });

    it("should match wildcard namespace", () => {
      expect(matchesEventFilter("project.created", ["project.*"])).toBe(true);
      expect(matchesEventFilter("project.updated", ["project.*"])).toBe(true);
      expect(matchesEventFilter("vote.cast", ["project.*"])).toBe(false);
    });

    it("should match global wildcard", () => {
      expect(matchesEventFilter("vote.cast", ["*"])).toBe(true);
      expect(matchesEventFilter("project.archived", ["*"])).toBe(true);
    });

    it("should match mixed patterns", () => {
      expect(matchesEventFilter("vote.cast", ["project.*", "vote.cast"])).toBe(true);
    });
  });

  describe("Payload formatting pipeline", () => {
    it("should produce valid JSON default format", () => {
      const payload = formatPayload("project.created", { title: "Test" });
      const parsed = JSON.parse(payload);
      expect(parsed.event).toBe("project.created");
      expect(parsed.data.title).toBe("Test");
      expect(parsed.timestamp).toBeDefined();
    });

    it("should apply custom templates", () => {
      const template = {
        format: "custom" as const,
        customTemplate: '{"type":"{{event}}","content":{{data}},"ts":"{{timestamp}}"}',
      };
      const payload = formatPayload("vote.cast", { value: 1 }, template);
      const parsed = JSON.parse(payload);
      expect(parsed.type).toBe("vote.cast");
    });

    it("should fallback to default on invalid custom template", () => {
      const template = {
        format: "custom" as const,
        customTemplate: "not valid json {{event}}",
      };
      const payload = formatPayload("vote.cast", { value: 1 }, template);
      const parsed = JSON.parse(payload);
      expect(parsed.event).toBe("vote.cast");
    });
  });

  describe("Retry strategies", () => {
    it("should compute exponential backoff correctly", () => {
      const config: RetryConfig = { strategy: "exponential", maxAttempts: 5, baseDelayMs: 1000 };
      expect(computeRetryDelay(config, 1)).toBe(1000);
      expect(computeRetryDelay(config, 2)).toBe(2000);
      expect(computeRetryDelay(config, 3)).toBe(4000);
    });

    it("should compute linear backoff correctly", () => {
      const config: RetryConfig = { strategy: "linear", maxAttempts: 3, baseDelayMs: 500 };
      expect(computeRetryDelay(config, 1)).toBe(500);
      expect(computeRetryDelay(config, 2)).toBe(1000);
      expect(computeRetryDelay(config, 3)).toBe(1500);
    });

    it("should compute fixed delay correctly", () => {
      const config: RetryConfig = { strategy: "fixed", maxAttempts: 3, baseDelayMs: 2000 };
      expect(computeRetryDelay(config, 1)).toBe(2000);
      expect(computeRetryDelay(config, 3)).toBe(2000);
    });
  });
});
