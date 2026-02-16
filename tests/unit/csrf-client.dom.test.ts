// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { getCsrfTokenClient } from "@/lib/csrf-client";

describe("getCsrfTokenClient", () => {
  beforeEach(() => {
    // Clear all cookies
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0].trim();
      if (name) document.cookie = `${name}=;expires=${new Date(0).toUTCString()};path=/`;
    });
  });

  it("returns empty string when no csrf_token cookie exists", () => {
    expect(getCsrfTokenClient()).toBe("");
  });

  it("returns the token value when csrf_token cookie is set", () => {
    document.cookie = "csrf_token=abc123;path=/";
    expect(getCsrfTokenClient()).toBe("abc123");
  });

  it("decodes URI-encoded token values", () => {
    document.cookie = `csrf_token=${encodeURIComponent("tok/en+val=ue")};path=/`;
    expect(getCsrfTokenClient()).toBe("tok/en+val=ue");
  });

  it("extracts csrf_token when multiple cookies exist", () => {
    document.cookie = "session=xyz;path=/";
    document.cookie = "csrf_token=mytoken;path=/";
    document.cookie = "other=value;path=/";
    expect(getCsrfTokenClient()).toBe("mytoken");
  });

  it("returns empty string when document is undefined (SSR)", () => {
    const origDoc = globalThis.document;
    // Simulate SSR by temporarily hiding document
    Object.defineProperty(globalThis, "document", { value: undefined, configurable: true });
    try {
      expect(getCsrfTokenClient()).toBe("");
    } finally {
      Object.defineProperty(globalThis, "document", { value: origDoc, configurable: true });
    }
  });
});
