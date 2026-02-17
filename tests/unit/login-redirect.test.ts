import { describe, it, expect } from "vitest";
import { getSafeRedirect } from "@/app/auth/login/page";

describe("getSafeRedirect", () => {
  it("returns / for null", () => {
    expect(getSafeRedirect(null)).toBe("/");
  });

  it("returns / for empty string", () => {
    expect(getSafeRedirect("")).toBe("/");
  });

  it("allows valid internal paths", () => {
    expect(getSafeRedirect("/dashboard")).toBe("/dashboard");
    expect(getSafeRedirect("/projects/123")).toBe("/projects/123");
    expect(getSafeRedirect("/profile")).toBe("/profile");
  });

  it("rejects protocol-relative URLs (//evil.com)", () => {
    expect(getSafeRedirect("//evil.com")).toBe("/");
    expect(getSafeRedirect("//evil.com/path")).toBe("/");
  });

  it("rejects absolute URLs", () => {
    expect(getSafeRedirect("https://evil.com")).toBe("/");
    expect(getSafeRedirect("http://evil.com")).toBe("/");
    expect(getSafeRedirect("ftp://evil.com")).toBe("/");
  });

  it("rejects URLs not starting with /", () => {
    expect(getSafeRedirect("evil.com")).toBe("/");
    expect(getSafeRedirect("javascript:alert(1)")).toBe("/");
  });

  it("rejects backslash-based bypass attempts", () => {
    expect(getSafeRedirect("/\\evil.com")).toBe("/");
    expect(getSafeRedirect("\\evil.com")).toBe("/");
  });

  it("allows paths with query strings", () => {
    expect(getSafeRedirect("/projects?tab=active")).toBe("/projects?tab=active");
  });

  it("allows paths with fragments", () => {
    expect(getSafeRedirect("/projects#section")).toBe("/projects#section");
  });
});
