import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPragma, mockClose, mockCheckRedisHealth } = vi.hoisted(() => ({
  mockPragma: vi.fn(),
  mockClose: vi.fn(),
  mockCheckRedisHealth: vi.fn(),
}));

vi.mock("better-sqlite3", () => {
  return {
    default: class MockDatabase {
      pragma = mockPragma;
      close = mockClose;
    },
  };
});

vi.mock("@/lib/redis", () => ({
  checkRedisHealth: () => mockCheckRedisHealth(),
}));

vi.mock("fs", () => ({
  mkdirSync: vi.fn(),
}));

import { GET } from "@/app/api/health/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/health", () => {
  it("returns healthy when DB and Redis are ok", async () => {
    mockCheckRedisHealth.mockResolvedValue("ok");
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(body.database).toBe("ok");
    expect(body.redis).toBe("ok");
  });

  it("returns healthy when Redis is disabled", async () => {
    mockCheckRedisHealth.mockResolvedValue("disabled");
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(body.redis).toBe("disabled");
  });

  it("returns degraded when Redis has error", async () => {
    mockCheckRedisHealth.mockResolvedValue("error");
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.redis).toBe("error");
  });

  it("returns degraded when DB has error", async () => {
    mockPragma.mockImplementation(() => { throw new Error("DB corrupt"); });
    mockCheckRedisHealth.mockResolvedValue("ok");
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.database).toBe("error");
  });

  it("includes timestamp and version", async () => {
    mockCheckRedisHealth.mockResolvedValue("disabled");
    const response = await GET();
    const body = await response.json();
    expect(body.timestamp).toBeDefined();
    expect(body.version).toBeDefined();
  });
});
