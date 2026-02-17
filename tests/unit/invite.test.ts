import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/mail", () => ({
  sendInvitationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/csrf", () => ({
  requireOrigin: vi.fn().mockReturnValue(null),
}));

vi.mock("@/db", () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    leftJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
  };
  return { db: mockDb };
});

vi.mock("@/db/schema", () => ({
  invitations: { id: "id", email: "email", token: "token", invitedBy: "invited_by", status: "status", expiresAt: "expires_at", createdAt: "created_at" },
  users: { id: "id", email: "email" },
}));

import { getCurrentUser } from "@/lib/auth";

describe("POST /api/admin/invite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const { POST } = await import("@/app/api/admin/invite/route");
    const request = new Request("http://localhost/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com" }),
    });

    const response = await POST(request as never);
    expect(response.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      email: "member@test.com",
      role: "member",
    } as never);

    const { POST } = await import("@/app/api/admin/invite/route");
    const request = new Request("http://localhost/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com" }),
    });

    const response = await POST(request as never);
    expect(response.status).toBe(403);
  });

  it("returns 400 for invalid email", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "admin-1",
      email: "admin@test.com",
      role: "admin",
    } as never);

    const { POST } = await import("@/app/api/admin/invite/route");
    const request = new Request("http://localhost/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });

    const response = await POST(request as never);
    expect(response.status).toBe(400);
  });

  it("returns 200 for valid invite request", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "admin-1",
      email: "admin@test.com",
      role: "admin",
    } as never);

    const { POST } = await import("@/app/api/admin/invite/route");
    const request = new Request("http://localhost/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "newuser@example.com" }),
    });

    const response = await POST(request as never);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
