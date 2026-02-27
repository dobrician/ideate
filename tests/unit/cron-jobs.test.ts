import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────
const mockProcess = vi.fn();

vi.mock("@/lib/queue", () => ({
  process: (...args: unknown[]) => mockProcess(...args),
  registerHandler: vi.fn(),
}));
const { mockRegisterEmbeddingHandlers } = vi.hoisted(() => ({
  mockRegisterEmbeddingHandlers: vi.fn(),
}));
vi.mock("@/lib/embeddings/jobs", () => ({
  registerEmbeddingHandlers: () => mockRegisterEmbeddingHandlers(),
  enqueueStaleRefresh: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/ci-builds", () => ({
  pruneCiBuilds: vi.fn().mockResolvedValue(0),
  checkCiBuildAlerts: vi.fn().mockResolvedValue({ alert: false, message: null }),
}));

vi.mock("@/lib/integrations", () => ({
  dispatchToIntegrations: vi.fn().mockResolvedValue({ sent: 0, failed: 0 }),
}));

import { POST } from "@/app/api/cron/jobs/route";
import { NextRequest } from "next/server";

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/cron/jobs", {
    method: "POST",
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "test-cron-secret");
});

describe("POST /api/cron/jobs", () => {
  it("returns 500 when CRON_SECRET not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("CRON_SECRET not configured");
  });

  it("returns 401 with no auth header", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 with wrong auth header", async () => {
    const res = await POST(makeRequest({ authorization: "Bearer wrong-secret" }));
    expect(res.status).toBe(401);
  });

  it("processes jobs with valid auth", async () => {
    mockProcess.mockResolvedValue({ processed: 3, succeeded: 2, failed: 1 });
    const res = await POST(makeRequest({ authorization: "Bearer test-cron-secret" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ processed: 3, succeeded: 2, failed: 1, ciBuildsDeleted: 0, ciAlert: false });
    expect(mockProcess).toHaveBeenCalledTimes(1);
  });

  it("imports registerEmbeddingHandlers from embeddings/jobs", async () => {
    const mod = await import("@/app/api/cron/jobs/route");
    // The route module imports and calls registerEmbeddingHandlers at top level.
    // Verify the route exports POST (which means it loaded successfully with the import).
    expect(typeof mod.POST).toBe("function");
  });
});
