import { describe, it, expect } from "vitest";
import { isValidSort } from "@/app/projects/[id]/queries";
import type { ProposalSort } from "@/app/projects/[id]/queries";

describe("isValidSort", () => {
  it("accepts 'votes'", () => {
    expect(isValidSort("votes")).toBe(true);
  });

  it("accepts 'newest'", () => {
    expect(isValidSort("newest")).toBe(true);
  });

  it("accepts 'oldest'", () => {
    expect(isValidSort("oldest")).toBe(true);
  });

  it("accepts 'comments'", () => {
    expect(isValidSort("comments")).toBe(true);
  });

  it("accepts 'controversy'", () => {
    expect(isValidSort("controversy")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isValidSort("")).toBe(false);
  });

  it("rejects invalid value", () => {
    expect(isValidSort("invalid")).toBe(false);
  });

  it("rejects random string", () => {
    expect(isValidSort("most-popular")).toBe(false);
  });
});

describe("ProposalSort type", () => {
  it("valid sorts can be typed as ProposalSort", () => {
    const sort: ProposalSort = "controversy";
    expect(sort).toBe("controversy");
  });
});
