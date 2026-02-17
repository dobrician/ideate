import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/db/schema", () => ({
  auditLogs: {
    id: "id",
    userId: "user_id",
    action: "action",
    entity: "entity",
    entityId: "entity_id",
    details: "details",
    ipAddress: "ip_address",
    createdAt: "created_at",
  },
  users: { id: "id", email: "email" },
}));

vi.mock("drizzle-orm", () => ({
  desc: vi.fn((col) => col),
  sql: Object.assign(vi.fn((...args: unknown[]) => args), {
    raw: vi.fn((s: string) => s),
  }),
  gte: vi.fn(),
  lte: vi.fn(),
}));

vi.mock("@/db", () => {
  const mockResult = [
    {
      id: "audit-1",
      action: "login",
      entity: "session",
      entityId: null,
      details: null,
      ipAddress: "127.0.0.1",
      createdAt: new Date("2026-01-01"),
      userEmail: "admin@test.com",
    },
  ];

  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(mockResult);
      }
      if (prop === Symbol.toStringTag) return "Promise";
      return () => new Proxy({}, handler);
    },
  };
  return { db: new Proxy({}, handler) };
});

import { getCurrentUser } from "@/lib/auth";

describe("GET /api/admin/audit-export", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import("@/app/api/admin/audit-export/route");
    const request = new Request("http://localhost/api/admin/audit-export?format=csv");
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      email: "member@test.com",
      role: "member",
    } as never);
    const { GET } = await import("@/app/api/admin/audit-export/route");
    const request = new Request("http://localhost/api/admin/audit-export?format=csv");
    const response = await GET(request);
    expect(response.status).toBe(403);
  });

  it("returns 400 for invalid format", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "admin-1",
      email: "admin@test.com",
      role: "admin",
    } as never);
    const { GET } = await import("@/app/api/admin/audit-export/route");
    const request = new Request("http://localhost/api/admin/audit-export?format=xml");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("returns CSV with correct content type", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "admin-1",
      email: "admin@test.com",
      role: "admin",
    } as never);
    const { GET } = await import("@/app/api/admin/audit-export/route");
    const request = new Request("http://localhost/api/admin/audit-export?format=csv");
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    const body = await response.text();
    expect(body).toContain("ID,Action,Entity");
  });

  it("returns JSON with correct content type", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "admin-1",
      email: "admin@test.com",
      role: "admin",
    } as never);
    const { GET } = await import("@/app/api/admin/audit-export/route");
    const request = new Request("http://localhost/api/admin/audit-export?format=json");
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    const data = await response.json();
    expect(data).toHaveLength(1);
    expect(data[0].action).toBe("login");
  });
});
