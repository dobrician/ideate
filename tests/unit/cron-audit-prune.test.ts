import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mockDeleteWhere = vi.fn().mockResolvedValue({ changes: 0 });
vi.mock("@/db", () => ({
  db: {
    delete: () => ({ where: (...a: unknown[]) => mockDeleteWhere(...a) }),
  },
}));
vi.mock("@/db/schema", () => ({
  auditLogs: { createdAt: "created_at" },
}));
vi.mock("drizzle-orm", () => ({
  lt: (col: unknown, val: unknown) => ({ col, val, op: "lt" }),
}));

const SECRET = "test-cron-secret-123";
let savedCronSecret: string | undefined;
let savedRetentionDays: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  savedCronSecret = process.env.CRON_SECRET;
  savedRetentionDays = process.env.AUDIT_RETENTION_DAYS;
  process.env.CRON_SECRET = SECRET;
  delete process.env.AUDIT_RETENTION_DAYS;
});

afterEach(() => {
  if (savedCronSecret !== undefined) process.env.CRON_SECRET = savedCronSecret;
  else delete process.env.CRON_SECRET;
  if (savedRetentionDays !== undefined) process.env.AUDIT_RETENTION_DAYS = savedRetentionDays;
  else delete process.env.AUDIT_RETENTION_DAYS;
});

function makeReq(bearer?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (bearer) headers.authorization = `Bearer ${bearer}`;
  return new NextRequest("http://localhost/api/cron/audit-prune", { headers });
}

describe("GET /api/cron/audit-prune", () => {
  it("returns 500 when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/cron/audit-prune/route");
    const res = await GET(makeReq(SECRET));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("CRON_SECRET not configured");
  });

  it("returns 401 with wrong bearer token", async () => {
    const { GET } = await import("@/app/api/cron/audit-prune/route");
    const res = await GET(makeReq("wrong-token"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 with no authorization header", async () => {
    const { GET } = await import("@/app/api/cron/audit-prune/route");
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("deletes old audit logs with default 90-day TTL", async () => {
    mockDeleteWhere.mockResolvedValueOnce({ changes: 42 });
    const { GET } = await import("@/app/api/cron/audit-prune/route");
    const res = await GET(makeReq(SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(42);
    expect(body.ttlDays).toBe(90);
    expect(mockDeleteWhere).toHaveBeenCalledOnce();
  });

  it("uses custom AUDIT_RETENTION_DAYS when set", async () => {
    process.env.AUDIT_RETENTION_DAYS = "30";
    mockDeleteWhere.mockResolvedValueOnce({ changes: 5 });
    const { GET } = await import("@/app/api/cron/audit-prune/route");
    const res = await GET(makeReq(SECRET));
    const body = await res.json();
    expect(body.ttlDays).toBe(30);
    expect(body.deleted).toBe(5);
  });

  it("returns 0 deleted when no old entries", async () => {
    mockDeleteWhere.mockResolvedValueOnce({ changes: 0 });
    const { GET } = await import("@/app/api/cron/audit-prune/route");
    const res = await GET(makeReq(SECRET));
    const body = await res.json();
    expect(body.deleted).toBe(0);
  });

  it("handles missing changes property gracefully", async () => {
    mockDeleteWhere.mockResolvedValueOnce({});
    const { GET } = await import("@/app/api/cron/audit-prune/route");
    const res = await GET(makeReq(SECRET));
    const body = await res.json();
    expect(body.deleted).toBe(0);
  });
});
