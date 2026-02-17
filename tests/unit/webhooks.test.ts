import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────
const mockFrom = vi.fn();
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

vi.mock("@/db/schema", () => ({ webhooks: {}, webhookDeliveries: {} }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { signPayload, fireWebhookEvent, deliverWebhook } from "@/lib/webhooks";
import { logger } from "@/lib/logger";
const mockedLogger = vi.mocked(logger);

const PAYLOAD = '{"event":"test","data":{},"timestamp":"2026-01-01T00:00:00.000Z"}';
const URL = "https://example.com/hook";

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
  mockValues.mockReturnValue({ returning: mockReturning });
  mockReturning.mockResolvedValue([{ id: "delivery-1" }]);
  mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
});

// ── Tests ──────────────────────────────────────────────────────────────────
describe("Webhook Library", () => {
  describe("signPayload", () => {
    it("creates a valid HMAC-SHA256 signature", () => {
      expect(signPayload('{"event":"test","data":{}}', "test-secret-key")).toMatch(/^[a-f0-9]{64}$/);
    });

    it("produces different signatures for different secrets", () => {
      expect(signPayload('{"event":"test"}', "secret-1"))
        .not.toBe(signPayload('{"event":"test"}', "secret-2"));
    });

    it("produces different signatures for different payloads", () => {
      expect(signPayload('{"event":"a"}', "same"))
        .not.toBe(signPayload('{"event":"b"}', "same"));
    });

    it("produces consistent signatures for same input", () => {
      const sig = signPayload('{"event":"test"}', "test-secret");
      expect(signPayload('{"event":"test"}', "test-secret")).toBe(sig);
    });
  });

  describe("fireWebhookEvent", () => {
    it("does not throw when no webhooks exist", async () => {
      await expect(fireWebhookEvent("project.created", { projectId: "p1" })).resolves.not.toThrow();
    });

    it("does not throw when db query fails", async () => {
      mockFrom.mockReturnValue({ where: vi.fn().mockRejectedValue(new Error("DB error")) });
      await expect(fireWebhookEvent("project.created", { projectId: "p1" })).resolves.not.toThrow();
    });

    it("filters webhooks by event subscription", async () => {
      const origFetch = globalThis.fetch;
      globalThis.fetch = async () => new Response("OK", { status: 200 });
      mockFrom.mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: "wh-1", url: URL, events: JSON.stringify(["project.created"]), secret: "s", active: true },
          { id: "wh-2", url: URL, events: JSON.stringify(["vote.cast"]), secret: "s2", active: true },
        ]),
      });
      let insertCount = 0;
      mockValues.mockImplementation(() => { insertCount++; return { returning: vi.fn().mockResolvedValue([{ id: `d-${insertCount}` }]) }; });
      await fireWebhookEvent("project.created", { projectId: "p1" });
      expect(insertCount).toBe(1);
      await new Promise((r) => setTimeout(r, 50));
      globalThis.fetch = origFetch;
    });

    it("logs error on insert failure", async () => {
      const origFetch = globalThis.fetch;
      globalThis.fetch = async () => new Response("OK", { status: 200 });
      mockFrom.mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: "wh-1", url: URL, events: JSON.stringify(["project.created"]), secret: "s", active: true },
        ]),
      });
      mockValues.mockRejectedValueOnce(new Error("Insert failed"));
      await fireWebhookEvent("project.created", { projectId: "p1" });
      expect(mockedLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: "project.created" }),
        "Failed to fire webhook event"
      );
      globalThis.fetch = origFetch;
    });
  });

  describe("deliverWebhook", () => {
    const originalFetch = globalThis.fetch;
    afterEach(() => { globalThis.fetch = originalFetch; });

    it("sends POST with correct headers", async () => {
      const calls: { url: string; init: RequestInit }[] = [];
      globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(input), init: init! });
        return new Response("OK", { status: 200 });
      };
      const p = '{"event":"project.created","data":{},"timestamp":"2026-01-01T00:00:00.000Z"}';
      await deliverWebhook("d-1", URL, "test-secret", p);
      expect(calls).toHaveLength(1);
      expect(calls[0].init.method).toBe("POST");
      const h = calls[0].init.headers as Record<string, string>;
      expect(h["X-Webhook-Signature"]).toMatch(/^sha256=[a-f0-9]{64}$/);
      expect(h["X-Webhook-Event"]).toBe("project.created");
    });

    it("retries on failure up to 3 times", { timeout: 15000 }, async () => {
      let count = 0;
      globalThis.fetch = async () => { count++; return new Response("Error", { status: 500 }); };
      await deliverWebhook("d-1", URL, "secret", PAYLOAD);
      expect(count).toBe(3);
    });

    it("succeeds on second retry after initial failure", async () => {
      let count = 0;
      globalThis.fetch = async () => {
        count++;
        return count === 1 ? new Response("Error", { status: 500 }) : new Response("OK", { status: 200 });
      };
      await deliverWebhook("d-1", URL, "secret", PAYLOAD);
      expect(count).toBe(2);
    });

    it("handles fetch errors with retry", async () => {
      let count = 0;
      globalThis.fetch = async () => {
        count++;
        if (count === 1) throw new Error("Network error");
        return new Response("OK", { status: 200 });
      };
      await deliverWebhook("d-1", URL, "secret", PAYLOAD);
      expect(count).toBe(2);
    });

    it("logs dead-letter on HTTP failure exhaustion", { timeout: 15000 }, async () => {
      globalThis.fetch = async () => new Response("Error", { status: 502 });
      await deliverWebhook("d-dl-1", URL, "secret", PAYLOAD);
      expect(mockedLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ deliveryId: "d-dl-1", deadLetter: true, status: 502 }),
        "Webhook delivery permanently failed"
      );
    });

    it("logs dead-letter on network error exhaustion", { timeout: 15000 }, async () => {
      globalThis.fetch = async () => { throw new Error("Connection refused"); };
      await deliverWebhook("d-dl-2", URL, "secret", PAYLOAD);
      expect(mockedLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ deliveryId: "d-dl-2", deadLetter: true }),
        "Webhook delivery permanently failed"
      );
    });

    it("sets DB status to failed on final attempt", { timeout: 15000 }, async () => {
      const setArgs: unknown[] = [];
      mockSet.mockImplementation((arg: unknown) => {
        setArgs.push(arg);
        return { where: vi.fn().mockResolvedValue(undefined) };
      });
      globalThis.fetch = async () => new Response("Error", { status: 500 });
      await deliverWebhook("d-status", URL, "secret", PAYLOAD);
      const lastSet = setArgs[setArgs.length - 1] as Record<string, unknown>;
      expect(lastSet.status).toBe("failed");
      expect(lastSet.attempts).toBe(3);
    });

    it("warns but does not error on intermediate failures", async () => {
      let count = 0;
      globalThis.fetch = async () => {
        count++;
        return count <= 2 ? new Response("Error", { status: 500 }) : new Response("OK", { status: 200 });
      };
      await deliverWebhook("d-retry", URL, "secret", PAYLOAD);
      expect(count).toBe(3);
      expect(mockedLogger.warn).toHaveBeenCalledTimes(2);
      expect(mockedLogger.error).not.toHaveBeenCalled();
      expect(mockedLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ deliveryId: "d-retry" }), "Webhook delivered"
      );
    });
  });
});
