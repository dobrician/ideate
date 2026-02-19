import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/perf-monitor", () => ({
  recordTiming: vi.fn(),
}));

import { middleware, config, REQUEST_TIMEOUT_MS } from "@/middleware";
import { recordTiming } from "@/lib/perf-monitor";

const mockRecordTiming = vi.mocked(recordTiming);

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(url = "http://localhost:3000/api/test", method = "GET") {
  return {
    method,
    nextUrl: { pathname: new URL(url).pathname },
  } as unknown as Parameters<typeof middleware>[0];
}

describe("Request Timing Middleware", () => {
  it("adds x-response-time header to response", () => {
    const res = middleware(makeRequest());
    expect(res.headers.get("x-response-time")).toMatch(/^\d+ms$/);
  });

  it("adds server-timing header to response", () => {
    const res = middleware(makeRequest());
    expect(res.headers.get("server-timing")).toMatch(/^total;dur=\d+$/);
  });

  it("records timing with correct path and method", () => {
    middleware(makeRequest("http://localhost:3000/dashboard", "POST"));
    expect(mockRecordTiming).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/dashboard",
        method: "POST",
      }),
    );
  });

  it("records timing with status code", () => {
    middleware(makeRequest());
    expect(mockRecordTiming).toHaveBeenCalledWith(
      expect.objectContaining({
        status: expect.any(Number),
        durationMs: expect.any(Number),
        timestamp: expect.any(Number),
      }),
    );
  });

  it("adds x-request-deadline header", () => {
    const res = middleware(makeRequest());
    const deadline = Number(res.headers.get("x-request-deadline"));
    expect(deadline).toBeGreaterThan(Date.now() - 1000);
  });

  it("adds x-request-timeout header with 30s value", () => {
    const res = middleware(makeRequest());
    expect(res.headers.get("x-request-timeout")).toBe(String(REQUEST_TIMEOUT_MS));
  });

  it("exports REQUEST_TIMEOUT_MS as 30000", () => {
    expect(REQUEST_TIMEOUT_MS).toBe(30_000);
  });

  it("exports matcher config excluding static assets", () => {
    expect(config.matcher).toBeDefined();
    expect(config.matcher[0]).toContain("_next/static");
    expect(config.matcher[0]).toContain("favicon.ico");
  });
});
