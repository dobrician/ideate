import { describe, it, expect, vi, beforeEach } from "vitest";
import { edgeLogger } from "@/lib/logger-edge";

describe("edgeLogger", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  it("logs info with structured data", () => {
    edgeLogger.info({ key: "val" }, "test message");
    expect(console.info).toHaveBeenCalledWith('test message {"key":"val"}');
  });

  it("logs warn with structured data", () => {
    edgeLogger.warn({ count: 5 }, "warning");
    expect(console.warn).toHaveBeenCalledWith('warning {"count":5}');
  });

  it("logs error with structured data", () => {
    edgeLogger.error({ err: "fail" }, "error occurred");
    expect(console.error).toHaveBeenCalledWith('error occurred {"err":"fail"}');
  });

  it("logs fatal via console.error", () => {
    edgeLogger.fatal({ code: 1 }, "fatal error");
    expect(console.error).toHaveBeenCalledWith('fatal error {"code":1}');
  });

  it("logs debug with structured data", () => {
    edgeLogger.debug({}, "debug msg");
    expect(console.debug).toHaveBeenCalledWith("debug msg");
  });

  it("formats message without data when data is empty", () => {
    edgeLogger.info({}, "no data");
    expect(console.info).toHaveBeenCalledWith("no data");
  });
});
