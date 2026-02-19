import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────
vi.mock("@/lib/cache", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));

import { cacheGet, cacheSet } from "@/lib/cache";
import { withCache, cachedRoute } from "@/lib/cache/middleware";
import { NextResponse } from "next/server";

const mockCacheGet = vi.mocked(cacheGet);
const mockCacheSet = vi.mocked(cacheSet);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("withCache", () => {
  it("returns cached value when available", async () => {
    mockCacheGet.mockReturnValue(JSON.stringify({ data: "cached" }));
    const fn = vi.fn().mockResolvedValue({ data: "fresh" });

    const result = await withCache("test-key", fn, 60);
    expect(result).toEqual({ data: "cached" });
    expect(fn).not.toHaveBeenCalled();
  });

  it("calls fn and caches result on miss", async () => {
    mockCacheGet.mockReturnValue(null);
    const fn = vi.fn().mockResolvedValue({ data: "fresh" });

    const result = await withCache("test-key", fn, 60);
    expect(result).toEqual({ data: "fresh" });
    expect(fn).toHaveBeenCalled();
    expect(mockCacheSet).toHaveBeenCalledWith(
      "test-key",
      JSON.stringify({ data: "fresh" }),
      60,
    );
  });

  it("uses default TTL of 300", async () => {
    mockCacheGet.mockReturnValue(null);
    const fn = vi.fn().mockResolvedValue("value");

    await withCache("key", fn);
    expect(mockCacheSet).toHaveBeenCalledWith("key", '"value"', 300);
  });
});

describe("cachedRoute", () => {
  const makeReq = (method = "GET", url = "http://localhost/api/test") =>
    new Request(url, { method }) as unknown as import("next/server").NextRequest;

  it("returns cached response for GET requests", async () => {
    mockCacheGet.mockReturnValue(JSON.stringify({ result: "cached" }));
    const handler = vi.fn();

    const route = cachedRoute(handler, { keyFn: () => "route-key" });
    const res = await route(makeReq());

    expect(res.headers.get("x-cache")).toBe("HIT");
    const body = await res.json();
    expect(body).toEqual({ result: "cached" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler and caches on miss", async () => {
    mockCacheGet.mockReturnValue(null);
    const handler = vi.fn().mockResolvedValue(
      NextResponse.json({ result: "fresh" }),
    );

    const route = cachedRoute(handler, { keyFn: () => "route-key", ttl: 120 });
    const res = await route(makeReq());

    expect(res.headers.get("x-cache")).toBe("MISS");
    expect(handler).toHaveBeenCalled();
    expect(mockCacheSet).toHaveBeenCalledWith(
      "route-key",
      expect.stringContaining("fresh"),
      120,
    );
  });

  it("skips cache for non-GET requests", async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));

    const route = cachedRoute(handler, { keyFn: () => "route-key" });
    const res = await route(makeReq("POST"));

    expect(handler).toHaveBeenCalled();
    expect(mockCacheGet).not.toHaveBeenCalled();
    expect(res.headers.get("x-cache")).toBeNull();
  });

  it("does not cache non-OK responses", async () => {
    mockCacheGet.mockReturnValue(null);
    const handler = vi.fn().mockResolvedValue(
      new NextResponse("Not Found", { status: 404 }),
    );

    const route = cachedRoute(handler, { keyFn: () => "route-key" });
    await route(makeReq());

    expect(mockCacheSet).not.toHaveBeenCalled();
  });
});
