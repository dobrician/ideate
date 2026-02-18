import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.fn();
const mockHasPermission = vi.fn();
const mockGetRateLimitStats = vi.fn();

vi.mock("@/lib/auth", () => ({
  getCurrentUser: (...a: unknown[]) => mockGetCurrentUser(...a),
}));
vi.mock("@/lib/rbac", () => ({
  hasPermission: (...a: unknown[]) => mockHasPermission(...a),
}));
vi.mock("@/lib/rate-limit", () => ({
  getRateLimitStats: (...a: unknown[]) => mockGetRateLimitStats(...a),
}));

import { GET } from "@/app/api/admin/rate-limits/route";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/admin/rate-limits", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 when user lacks permission", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "u1", role: "member" });
    mockHasPermission.mockReturnValue(false);
    const res = await GET();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
  });

  it("returns stats for admin user", async () => {
    const fakeStats = {
      totalKeys: 3,
      keys: [{ key: "ip:1", hitCount: 5, oldestHit: Date.now() }],
    };
    mockGetCurrentUser.mockResolvedValue({ id: "u1", role: "admin" });
    mockHasPermission.mockReturnValue(true);
    mockGetRateLimitStats.mockReturnValue(fakeStats);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalKeys).toBe(3);
    expect(body.keys).toHaveLength(1);
    expect(body.keys[0].key).toBe("ip:1");
  });

  it("returns empty stats when no active entries", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "u1", role: "admin" });
    mockHasPermission.mockReturnValue(true);
    mockGetRateLimitStats.mockReturnValue({ totalKeys: 0, keys: [] });
    const res = await GET();
    const body = await res.json();
    expect(body.totalKeys).toBe(0);
    expect(body.keys).toEqual([]);
  });
});
