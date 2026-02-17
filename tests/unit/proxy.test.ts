import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

const BASE_URL = "http://localhost:3000";

/** Build a fake JWT with the given payload (no real signature, but valid structure). */
function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

/** A valid-looking session JWT that expires in 1 hour */
function validSessionJwt(): string {
  return fakeJwt({
    userId: "user-123",
    email: "test@example.com",
    type: "session",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
}

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

describe("Proxy", () => {
  describe("public paths", () => {
    it("should allow access to the home page without authentication", () => {
      const request = createRequest("/");
      const response = proxy(request);

      expect(isNextResponse(response)).toBe(true);
    });

    it("should allow access to /auth/login without authentication", () => {
      const request = createRequest("/auth/login");
      const response = proxy(request);

      expect(isNextResponse(response)).toBe(true);
    });

    it("should allow access to /auth/verify without authentication", () => {
      const request = createRequest("/auth/verify");
      const response = proxy(request);

      expect(isNextResponse(response)).toBe(true);
    });

    it("should allow access to /auth/request without authentication", () => {
      const request = createRequest("/auth/request");
      const response = proxy(request);

      expect(isNextResponse(response)).toBe(true);
    });

    it("should allow access to /auth/logout without authentication", () => {
      const request = createRequest("/auth/logout");
      const response = proxy(request);

      expect(isNextResponse(response)).toBe(true);
    });

    it("should allow access to /api/health without authentication", () => {
      const request = createRequest("/api/health");
      const response = proxy(request);

      expect(isNextResponse(response)).toBe(true);
    });
  });

  describe("static assets", () => {
    it("should allow access to _next/ prefixed paths", () => {
      const request = createRequest("/_next/static/chunks/main.js");
      const response = proxy(request);

      expect(isNextResponse(response)).toBe(true);
    });

    it("should allow access to _next/image paths", () => {
      const request = createRequest("/_next/image?url=/photo.png&w=640&q=75");
      const response = proxy(request);

      expect(isNextResponse(response)).toBe(true);
    });

    it("should allow access to favicon.ico", () => {
      const request = createRequest("/favicon.ico");
      const response = proxy(request);

      expect(isNextResponse(response)).toBe(true);
    });

    it("should allow access to .css files", () => {
      const request = createRequest("/styles/globals.css");
      const response = proxy(request);

      expect(isNextResponse(response)).toBe(true);
    });

    it("should allow access to .js files", () => {
      const request = createRequest("/scripts/analytics.js");
      const response = proxy(request);

      expect(isNextResponse(response)).toBe(true);
    });

    it("should allow access to .svg files", () => {
      const request = createRequest("/images/logo.svg");
      const response = proxy(request);

      expect(isNextResponse(response)).toBe(true);
    });

    it("should allow access to .woff2 font files", () => {
      const request = createRequest("/fonts/inter.woff2");
      const response = proxy(request);

      expect(isNextResponse(response)).toBe(true);
    });

    it("should NOT treat paths with dots as static if extension is unknown", () => {
      const request = createRequest("/admin/export.csv");
      const response = proxy(request);

      // Should require auth and redirect to login
      expect(response.status).toBe(307);
      const redirectUrl = getRedirectUrl(response);
      expect(redirectUrl!.pathname).toBe("/auth/login");
    });

    it("should NOT bypass auth for paths with arbitrary dots", () => {
      const request = createRequest("/admin/user.settings");
      const response = proxy(request);

      expect(response.status).toBe(307);
    });
  });

  describe("protected paths without session cookie", () => {
    it("should redirect to /auth/login when accessing /projects without session", () => {
      const request = createRequest("/projects");
      const response = proxy(request);

      expect(response.status).toBe(307);
      const redirectUrl = getRedirectUrl(response);
      expect(redirectUrl).not.toBeNull();
      expect(redirectUrl!.pathname).toBe("/auth/login");
    });

    it("should redirect to /auth/login when accessing /profile without session", () => {
      const request = createRequest("/profile");
      const response = proxy(request);

      expect(response.status).toBe(307);
      const redirectUrl = getRedirectUrl(response);
      expect(redirectUrl).not.toBeNull();
      expect(redirectUrl!.pathname).toBe("/auth/login");
    });

    it("should redirect when session cookie is present but empty", () => {
      const request = createRequest("/projects", { sessionCookie: "" });
      const response = proxy(request);

      expect(response.status).toBe(307);
      const redirectUrl = getRedirectUrl(response);
      expect(redirectUrl).not.toBeNull();
      expect(redirectUrl!.pathname).toBe("/auth/login");
    });
  });

  describe("protected paths with session cookie", () => {
    it("should allow access to /projects when session cookie is present", () => {
      const request = createRequest("/projects", { sessionCookie: validSessionJwt() });
      const response = proxy(request);

      expect(isNextResponse(response)).toBe(true);
    });

    it("should allow access to /profile when session cookie is present", () => {
      const request = createRequest("/profile", { sessionCookie: validSessionJwt() });
      const response = proxy(request);

      expect(isNextResponse(response)).toBe(true);
    });

    it("should allow access to nested protected paths when session cookie is present", () => {
      const request = createRequest("/projects/123/proposals", {
        sessionCookie: validSessionJwt(),
      });
      const response = proxy(request);

      expect(isNextResponse(response)).toBe(true);
    });
  });

  describe("JWT validation", () => {
    it("should redirect when session cookie is a random string (not a JWT)", () => {
      const request = createRequest("/projects", { sessionCookie: "not-a-jwt" });
      const response = proxy(request);

      expect(response.status).toBe(307);
      const redirectUrl = getRedirectUrl(response);
      expect(redirectUrl!.pathname).toBe("/auth/login");
    });

    it("should redirect when JWT is expired", () => {
      const expiredJwt = fakeJwt({
        userId: "user-123",
        email: "test@example.com",
        type: "session",
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      });
      const request = createRequest("/projects", { sessionCookie: expiredJwt });
      const response = proxy(request);

      expect(response.status).toBe(307);
      const redirectUrl = getRedirectUrl(response);
      expect(redirectUrl!.pathname).toBe("/auth/login");
    });

    it("should redirect when JWT has wrong type", () => {
      const wrongTypeJwt = fakeJwt({
        userId: "user-123",
        email: "test@example.com",
        type: "magic-link",
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      const request = createRequest("/projects", { sessionCookie: wrongTypeJwt });
      const response = proxy(request);

      expect(response.status).toBe(307);
    });

    it("should redirect when JWT payload has no userId", () => {
      const noUserJwt = fakeJwt({
        email: "test@example.com",
        type: "session",
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      const request = createRequest("/projects", { sessionCookie: noUserJwt });
      const response = proxy(request);

      expect(response.status).toBe(307);
    });

    it("should allow a valid session JWT", () => {
      const request = createRequest("/projects", { sessionCookie: validSessionJwt() });
      const response = proxy(request);

      expect(isNextResponse(response)).toBe(true);
    });
  });

  describe("security headers", () => {
    it("includes HSTS header on public paths", () => {
      const request = createRequest("/");
      const response = proxy(request);
      expect(response.headers.get("Strict-Transport-Security")).toBe(
        "max-age=63072000; includeSubDomains"
      );
    });

    it("includes HSTS header on protected paths", () => {
      const request = createRequest("/projects", { sessionCookie: validSessionJwt() });
      const response = proxy(request);
      expect(response.headers.get("Strict-Transport-Security")).toBe(
        "max-age=63072000; includeSubDomains"
      );
    });

    it("includes HSTS header on redirect responses", () => {
      const request = createRequest("/projects");
      const response = proxy(request);
      expect(response.status).toBe(307);
      expect(response.headers.get("Strict-Transport-Security")).toBe(
        "max-age=63072000; includeSubDomains"
      );
    });
  });

  describe("redirect URL", () => {
    it("should include the original path as redirect param", () => {
      const request = createRequest("/projects");
      const response = proxy(request);

      const redirectUrl = getRedirectUrl(response);
      expect(redirectUrl).not.toBeNull();
      expect(redirectUrl!.searchParams.get("redirect")).toBe("/projects");
    });

    it("should include a nested path as redirect param", () => {
      const request = createRequest("/projects/456/edit");
      const response = proxy(request);

      const redirectUrl = getRedirectUrl(response);
      expect(redirectUrl).not.toBeNull();
      expect(redirectUrl!.searchParams.get("redirect")).toBe("/projects/456/edit");
    });

    it("should include /profile as redirect param when accessing profile", () => {
      const request = createRequest("/profile");
      const response = proxy(request);

      const redirectUrl = getRedirectUrl(response);
      expect(redirectUrl).not.toBeNull();
      expect(redirectUrl!.searchParams.get("redirect")).toBe("/profile");
    });
  });
});
