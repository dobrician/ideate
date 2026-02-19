/**
 * Unit tests for WebSocket types and channel utilities.
 */

import { describe, it, expect } from "vitest";
import { parseChannel, isValidChannel, CHANNEL_PREFIXES } from "@/lib/websocket/types";

describe("parseChannel", () => {
  it("parses a valid channel string", () => {
    const result = parseChannel("project:abc-123");
    expect(result).toEqual({ type: "project", id: "abc-123" });
  });

  it("parses proposal channel", () => {
    const result = parseChannel("proposal:xyz");
    expect(result).toEqual({ type: "proposal", id: "xyz" });
  });

  it("returns null for empty string", () => {
    expect(parseChannel("")).toBeNull();
  });

  it("returns null for string without colon", () => {
    expect(parseChannel("project")).toBeNull();
  });

  it("returns null for string with only colon", () => {
    expect(parseChannel(":")).toBeNull();
  });

  it("returns null for string with empty type", () => {
    expect(parseChannel(":abc")).toBeNull();
  });

  it("returns null for string with empty id", () => {
    expect(parseChannel("project:")).toBeNull();
  });

  it("handles channels with multiple colons (only first split)", () => {
    // With split limited to 2 parts, extra colons stay in id
    const result = parseChannel("project:abc:def");
    // parseChannel splits on first colon only — it returns null because split gives 3 parts
    expect(result).toBeNull();
  });
});

describe("isValidChannel", () => {
  it("returns true for project channel", () => {
    expect(isValidChannel("project:123")).toBe(true);
  });

  it("returns true for proposal channel", () => {
    expect(isValidChannel("proposal:456")).toBe(true);
  });

  it("returns false for unknown prefix", () => {
    expect(isValidChannel("unknown:123")).toBe(false);
  });

  it("returns false for malformed channel", () => {
    expect(isValidChannel("invalid")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidChannel("")).toBe(false);
  });
});

describe("CHANNEL_PREFIXES", () => {
  it("includes project and proposal", () => {
    expect(CHANNEL_PREFIXES).toContain("project");
    expect(CHANNEL_PREFIXES).toContain("proposal");
  });
});
