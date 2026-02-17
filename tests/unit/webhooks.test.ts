import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockValues = vi.fn();
const mockSet = vi.fn();
const mockReturning = vi.fn();

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
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Import SUT ─────────────────────────────────────────────────────────────

import { signPayload, fireWebhookEvent, deliverWebhook } from "@/lib/webhooks";

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockResolvedValue([]);
  mockValues.mockReturnValue({ returning: mockReturning });
  mockReturning.mockResolvedValue([{ id: "delivery-1" }]);
  mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Webhook Library", () => {
  describe("signPayload", () => {
    it("should create a valid HMAC-SHA256 signature", () => {
      const payload = '{"event":"test","data":{}}';
      const secret = "test-secret-key";

      const signature = signPayload(payload, secret);

      expect(signature).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should produce different signatures for different secrets", () => {
      const payload = '{"event":"test"}';

      const sig1 = signPayload(payload, "secret-1");
      const sig2 = signPayload(payload, "secret-2");

      expect(sig1).not.toBe(sig2);
    });

    it("should produce different signatures for different payloads", () => {
      const secret = "same-secret";

      const sig1 = signPayload('{"event":"a"}', secret);
      const sig2 = signPayload('{"event":"b"}', secret);

      expect(sig1).not.toBe(sig2);
    });

    it("should produce consistent signatures for same input", () => {
      const payload = '{"event":"test"}';
      const secret = "test-secret";

      const sig1 = signPayload(payload, secret);
      const sig2 = signPayload(payload, secret);

      expect(sig1).toBe(sig2);
    });
  });

  describe("fireWebhookEvent", () => {
    it("should not throw when no webhooks exist", async () => {
      mockFrom.mockReturnValue({ where: vi.fn().mockResolvedValue([]) });

      await expect(
        fireWebhookEvent("project.created", { projectId: "p1" })
      ).resolves.not.toThrow();
    });

    it("should not throw when db query fails", async () => {
      mockFrom.mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error("DB error")),
      });

      await expect(
        fireWebhookEvent("project.created", { projectId: "p1" })
      ).resolves.not.toThrow();
    });

    it("should filter webhooks by event subscription", async () => {
      // Replace fetch to absorb fire-and-forget deliveries
      const origFetch = globalThis.fetch;
      globalThis.fetch = async () => new Response("OK", { status: 200 });

      const matchingWebhook = {
        id: "wh-1",
        url: "https://example.com/hook",
        events: JSON.stringify(["project.created"]),
        secret: "test-secret",
        active: true,
      };
      const nonMatchingWebhook = {
        id: "wh-2",
        url: "https://example.com/hook2",
        events: JSON.stringify(["vote.cast"]),
        secret: "test-secret-2",
        active: true,
      };

      mockFrom.mockReturnValue({
        where: vi.fn().mockResolvedValue([matchingWebhook, nonMatchingWebhook]),
      });

      // Mock the insert to track calls
      let insertCount = 0;
      mockValues.mockImplementation(() => {
        insertCount++;
        return { returning: vi.fn().mockResolvedValue([{ id: `d-${insertCount}` }]) };
      });

      await fireWebhookEvent("project.created", { projectId: "p1" });

      // Only one webhook matches the event
      expect(insertCount).toBe(1);

      // Wait briefly for fire-and-forget deliveries to settle
      await new Promise((r) => setTimeout(r, 50));
      globalThis.fetch = origFetch;
    });
  });

  describe("deliverWebhook", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("should send POST request with correct headers", async () => {
      const calls: { url: string; init: RequestInit }[] = [];
      globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(input), init: init! });
        return new Response("OK", { status: 200 });
      };

      await deliverWebhook(
        "d-1",
        "https://example.com/hook",
        "test-secret",
        '{"event":"project.created","data":{},"timestamp":"2026-01-01T00:00:00.000Z"}'
      );

      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe("https://example.com/hook");
      expect(calls[0].init.method).toBe("POST");
      const headers = calls[0].init.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["X-Webhook-Signature"]).toMatch(/^sha256=[a-f0-9]{64}$/);
      expect(headers["X-Webhook-Event"]).toBe("project.created");
      expect(headers["X-Webhook-Delivery"]).toBe("d-1");
    });

    it("should retry on failure up to 3 times", { timeout: 15000 }, async () => {
      const urls: string[] = [];
      globalThis.fetch = async (input: string | URL | Request) => {
        urls.push(String(input));
        return new Response("Error", { status: 500 });
      };

      await deliverWebhook(
        "d-1",
        "https://example.com/hook",
        "secret",
        '{"event":"test","data":{},"timestamp":"2026-01-01T00:00:00.000Z"}'
      );

      // Only count calls to our webhook URL (not other fetches)
      const webhookCalls = urls.filter((u) => u === "https://example.com/hook");
      expect(webhookCalls).toHaveLength(3);
    });

    it("should succeed on second retry after initial failure", async () => {
      let callCount = 0;
      globalThis.fetch = async () => {
        callCount++;
        if (callCount === 1) return new Response("Error", { status: 500 });
        return new Response("OK", { status: 200 });
      };

      await deliverWebhook(
        "d-1",
        "https://example.com/hook",
        "secret",
        '{"event":"test","data":{},"timestamp":"2026-01-01T00:00:00.000Z"}'
      );

      expect(callCount).toBe(2);
    });

    it("should handle fetch errors with retry", async () => {
      let callCount = 0;
      globalThis.fetch = async () => {
        callCount++;
        if (callCount === 1) throw new Error("Network error");
        return new Response("OK", { status: 200 });
      };

      await deliverWebhook(
        "d-1",
        "https://example.com/hook",
        "secret",
        '{"event":"test","data":{},"timestamp":"2026-01-01T00:00:00.000Z"}'
      );

      expect(callCount).toBe(2);
    });
  });
});
