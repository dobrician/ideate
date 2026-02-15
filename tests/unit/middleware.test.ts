import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

const BASE_URL = "http://localhost:3000";

/**
 * Create a NextRequest for the given path, optionally with a session cookie.
 */
function createRequest(path: string, options?: { sessionCookie?: string }): NextRequest {
  const url = new URL(path, BASE_URL);
  const headers: Record<string, string> = {};
  if (options?.sessionCookie) {
    headers.cookie = `session=${options.sessionCookie}`;
  }
  return new NextRequest(url, { headers });
}

/**
 * Check whether a response is a "pass-through" (NextResponse.next()).
 * NextResponse.next() has no Location header and a 200 status.
 */
function isNextResponse(response: Response): boolean {
  return response.status === 200 && !response.headers.has("location");
}

/**
 * Check whether a response is a redirect and extract its target URL.
 */
function getRedirectUrl(response: Response): URL | null {
  const location = response.headers.get("location");
  if (!location) return null;
  return new URL(location);
}

describe("Middleware", () => {
  describe("public paths", () => {
    it("should allow access to the home page without authentication", () => {
      const request = createRequest("/");
      const response = middleware(request);

      expect(isNextResponse(response)).toBe(true);
    });

    it("should allow access to /auth/login without authentication", () => {
      const request = createRequest("/auth/login");
      const response = middleware(request);

      expect(isNextResponse(response)).toBe(true);
    });

    it("should allow access to /auth/verify without authentication", () => {
      const request = createRequest("/auth/verify");
      const response = middleware(request);

      expect(isNextResponse(response)).toBe(true);
    });

    it("should allow access to /auth/request without authentication", () => {
      const request = createRequest("/auth/request");
      const response = middleware(request);

      expect(isNextResponse(response)).toBe(true);
    });

    it("should allow access to /auth/logout without authentication", () => {
      const request = createRequest("/auth/logout");
      const response = middleware(request);

      expect(isNextResponse(response)).toBe(true);
    });

    it("should allow access to /api/health without authentication", () => {
      const request = createRequest("/api/health");
      const response = middleware(request);

      expect(isNextResponse(response)).toBe(true);
    });
  });

  describe("static assets", () => {
    it("should allow access to _next/ prefixed paths", () => {
      const request = createRequest("/_next/static/chunks/main.js");
      const response = middleware(request);

      expect(isNextResponse(response)).toBe(true);
    });

    it("should allow access to _next/image paths", () => {
      const request = createRequest("/_next/image?url=/photo.png&w=640&q=75");
      const response = middleware(request);

      expect(isNextResponse(response)).toBe(true);
    });

    it("should allow access to favicon.ico", () => {
      const request = createRequest("/favicon.ico");
      const response = middleware(request);

      expect(isNextResponse(response)).toBe(true);
    });

    it("should allow access to .css files", () => {
      const request = createRequest("/styles/globals.css");
      const response = middleware(request);

      expect(isNextResponse(response)).toBe(true);
    });

    it("should allow access to .js files", () => {
      const request = createRequest("/scripts/analytics.js");
      const response = middleware(request);

      expect(isNextResponse(response)).toBe(true);
    });

    it("should allow access to .svg files", () => {
      const request = createRequest("/images/logo.svg");
      const response = middleware(request);

      expect(isNextResponse(response)).toBe(true);
    });
  });

  describe("protected paths without session cookie", () => {
    it("should redirect to /auth/login when accessing /projects without session", () => {
      const request = createRequest("/projects");
      const response = middleware(request);

      expect(response.status).toBe(307);
      const redirectUrl = getRedirectUrl(response);
      expect(redirectUrl).not.toBeNull();
      expect(redirectUrl!.pathname).toBe("/auth/login");
    });

    it("should redirect to /auth/login when accessing /profile without session", () => {
      const request = createRequest("/profile");
      const response = middleware(request);

      expect(response.status).toBe(307);
      const redirectUrl = getRedirectUrl(response);
      expect(redirectUrl).not.toBeNull();
      expect(redirectUrl!.pathname).toBe("/auth/login");
    });

    it("should redirect when session cookie is present but empty", () => {
      const request = createRequest("/projects", { sessionCookie: "" });
      const response = middleware(request);

      expect(response.status).toBe(307);
      const redirectUrl = getRedirectUrl(response);
      expect(redirectUrl).not.toBeNull();
      expect(redirectUrl!.pathname).toBe("/auth/login");
    });
  });

  describe("protected paths with session cookie", () => {
    it("should allow access to /projects when session cookie is present", () => {
      const request = createRequest("/projects", { sessionCookie: "valid-session-token" });
      const response = middleware(request);

      expect(isNextResponse(response)).toBe(true);
    });

    it("should allow access to /profile when session cookie is present", () => {
      const request = createRequest("/profile", { sessionCookie: "valid-session-token" });
      const response = middleware(request);

      expect(isNextResponse(response)).toBe(true);
    });

    it("should allow access to nested protected paths when session cookie is present", () => {
      const request = createRequest("/projects/123/proposals", {
        sessionCookie: "valid-session-token",
      });
      const response = middleware(request);

      expect(isNextResponse(response)).toBe(true);
    });
  });

  describe("redirect URL", () => {
    it("should include the original path as redirect param", () => {
      const request = createRequest("/projects");
      const response = middleware(request);

      const redirectUrl = getRedirectUrl(response);
      expect(redirectUrl).not.toBeNull();
      expect(redirectUrl!.searchParams.get("redirect")).toBe("/projects");
    });

    it("should include a nested path as redirect param", () => {
      const request = createRequest("/projects/456/edit");
      const response = middleware(request);

      const redirectUrl = getRedirectUrl(response);
      expect(redirectUrl).not.toBeNull();
      expect(redirectUrl!.searchParams.get("redirect")).toBe("/projects/456/edit");
    });

    it("should include /profile as redirect param when accessing profile", () => {
      const request = createRequest("/profile");
      const response = middleware(request);

      const redirectUrl = getRedirectUrl(response);
      expect(redirectUrl).not.toBeNull();
      expect(redirectUrl!.searchParams.get("redirect")).toBe("/profile");
    });
  });
});
