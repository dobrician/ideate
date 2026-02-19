import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/perf-monitor", () => ({
  recordTiming: vi.fn(),
}));

import { middleware, config } from "@/middleware";
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

  it("exports matcher config excluding static assets", () => {
    expect(config.matcher).toBeDefined();
    expect(config.matcher[0]).toContain("_next/static");
    expect(config.matcher[0]).toContain("favicon.ico");
  });
});
