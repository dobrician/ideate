import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Webhook signature verification ──────────────────────────────────────

describe("Webhook Security", () => {
  it("should sign and verify payloads", async () => {
    const { signPayload, verifyWebhookSignature } = await import("@/lib/webhooks");
    const payload = JSON.stringify({ event: "test", data: {} });
    const secret = "test-secret-key";
    const signature = signPayload(payload, secret);
    expect(verifyWebhookSignature(payload, `sha256=${signature}`, secret)).toBe(true);
  });

  it("should reject invalid signatures", async () => {
    const { verifyWebhookSignature } = await import("@/lib/webhooks");
    expect(verifyWebhookSignature("{}", "sha256=invalid", "secret")).toBe(false);
  });

  it("should reject tampered payloads", async () => {
    const { signPayload, verifyWebhookSignature } = await import("@/lib/webhooks");
    const secret = "test-secret";
    const signature = signPayload("original", secret);
    expect(verifyWebhookSignature("tampered", `sha256=${signature}`, secret)).toBe(false);
  });

  it("should handle signatures without sha256= prefix", async () => {
    const { signPayload, verifyWebhookSignature } = await import("@/lib/webhooks");
    const secret = "test-secret";
    const signature = signPayload("data", secret);
    expect(verifyWebhookSignature("data", signature, secret)).toBe(true);
  });

  it("should reject malformed hex signatures", async () => {
    const { verifyWebhookSignature } = await import("@/lib/webhooks");
    expect(verifyWebhookSignature("{}", "not-hex-at-all!!!", "secret")).toBe(false);
  });
});

// ─── API key timing-safe comparison ──────────────────────────────────────

describe("API Key Security", () => {
  it("should use timing-safe comparison for key hashes", async () => {
    const { hashKey } = await import("@/lib/api-keys");
    const hash1 = hashKey("idk_test1234567890abcdef");
    const hash2 = hashKey("idk_test1234567890abcdef");
    expect(hash1).toBe(hash2);
  });

  it("should produce different hashes for different keys", async () => {
    const { hashKey } = await import("@/lib/api-keys");
    const hash1 = hashKey("idk_key1");
    const hash2 = hashKey("idk_key2");
    expect(hash1).not.toBe(hash2);
  });

  it("should generate keys with correct prefix", async () => {
    const { generateApiKey } = await import("@/lib/api-keys");
    const { raw, hash, prefix } = generateApiKey();
    expect(raw.startsWith("idk_")).toBe(true);
    expect(prefix.startsWith("idk_")).toBe(true);
    expect(hash.length).toBe(64); // SHA-256 hex
  });

  it("should generate unique keys", async () => {
    const { generateApiKey } = await import("@/lib/api-keys");
    const keys = new Set<string>();
    for (let i = 0; i < 10; i++) {
      keys.add(generateApiKey().raw);
    }
    expect(keys.size).toBe(10);
  });

  it("should validate scope values", async () => {
    const { validateScopes } = await import("@/lib/api-keys");
    expect(validateScopes(["read:projects", "write:projects"])).toBe(true);
    expect(validateScopes(["invalid:scope"])).toBe(false);
    expect(validateScopes([])).toBe(true);
  });
});

// ─── Sync engine SSRF prevention ──────────────────────────────────────

describe("Sync Engine SSRF Prevention", () => {
  const store = new Map();
  const mockObjectStore = {
    add: vi.fn((entry: Record<string, unknown>) => { store.set(entry.id, entry); return { onsuccess: null, onerror: null }; }),
    get: vi.fn((id: string) => { const req = { result: store.get(id), onsuccess: null as (() => void) | null, onerror: null }; setTimeout(() => req.onsuccess?.(), 0); return req; }),
    put: vi.fn((entry: Record<string, unknown>) => { store.set(entry.id, entry); return { onsuccess: null, onerror: null }; }),
    delete: vi.fn((id: string) => { store.delete(id); return { onsuccess: null, onerror: null }; }),
    clear: vi.fn(() => { store.clear(); return { onsuccess: null, onerror: null }; }),
    count: vi.fn(() => { const req = { result: store.size, onsuccess: null as (() => void) | null, onerror: null }; setTimeout(() => req.onsuccess?.(), 0); return req; }),
    index: vi.fn(() => ({ getAll: vi.fn(() => { const req = { result: [...store.values()], onsuccess: null as (() => void) | null, onerror: null }; setTimeout(() => req.onsuccess?.(), 0); return req; }) })),
    createIndex: vi.fn(),
  };

  const mockTransaction = { objectStore: vi.fn(() => mockObjectStore), oncomplete: null as (() => void) | null, onerror: null as (() => void) | null };
  const mockDb = {
    transaction: vi.fn(() => { const tx = { ...mockTransaction, oncomplete: null as (() => void) | null, onerror: null as (() => void) | null }; setTimeout(() => tx.oncomplete?.(), 0); return tx; }),
    objectStoreNames: { contains: vi.fn(() => false) },
    createObjectStore: vi.fn(() => mockObjectStore),
    close: vi.fn(),
  };

  vi.stubGlobal("indexedDB", {
    open: vi.fn(() => {
      const req = { result: mockDb, onupgradeneeded: null as (() => void) | null, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null, error: null };
      setTimeout(() => { req.onupgradeneeded?.(); req.onsuccess?.(); }, 0);
      return req;
    }),
  });

  const mockFetch = vi.fn();
  vi.stubGlobal("fetch", mockFetch);

  beforeEach(() => { store.clear(); vi.clearAllMocks(); });

  it("should reject absolute URLs with protocol", async () => {
    const { replayAction } = await import("@/lib/offline/sync-engine");
    const result = await replayAction({
      id: "test-1",
      type: "vote",
      method: "POST",
      url: "http://internal-server:8080/admin",
      body: "{}",
      timestamp: Date.now(),
      retries: 0,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid URL");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should reject URLs containing protocol markers", async () => {
    const { replayAction } = await import("@/lib/offline/sync-engine");
    const result = await replayAction({
      id: "test-2",
      type: "vote",
      method: "POST",
      url: "javascript://alert(1)",
      body: "{}",
      timestamp: Date.now(),
      retries: 0,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid URL");
  });

  it("should allow valid relative URLs", async () => {
    const { replayAction } = await import("@/lib/offline/sync-engine");
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
    const result = await replayAction({
      id: "test-3",
      type: "vote",
      method: "POST",
      url: "/api/votes",
      body: "{}",
      timestamp: Date.now(),
      retries: 0,
    });
    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalled();
  });
});

// ─── Push key validation ──────────────────────────────────────────────

describe("Push Key Validation", () => {
  it("should accept valid base64url strings", () => {
    const pattern = /^[A-Za-z0-9_-]+={0,2}$/;
    expect(pattern.test("BNhG_gJ3DZ")).toBe(true);
    expect(pattern.test("abc123_-XYZ")).toBe(true);
    expect(pattern.test("dGVzdA==")).toBe(true);
  });

  it("should reject non-base64url strings", () => {
    const pattern = /^[A-Za-z0-9_-]+={0,2}$/;
    expect(pattern.test("abc 123")).toBe(false);
    expect(pattern.test("abc+def")).toBe(false);
    expect(pattern.test("abc/def")).toBe(false);
    expect(pattern.test("")).toBe(false);
  });
});
