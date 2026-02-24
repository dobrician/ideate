import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

const BASE = "http://localhost:3000";

function fakeJwt(payload: Record<string, unknown>): string {
  const h = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const b = btoa(JSON.stringify(payload));
  return `${h}.${b}.fake-sig`;
}

function validJwt(): string {
  return fakeJwt({ userId: "u1", type: "session", exp: Math.floor(Date.now() / 1000) + 3600 });
}

function req(path: string, session?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (session) headers.cookie = `session=${session}`;
  return new NextRequest(new URL(path, BASE), { headers });
}

function isPass(r: Response) { return r.status === 200 && !r.headers.has("location"); }
function redirectTo(r: Response) { const l = r.headers.get("location"); return l ? new URL(l) : null; }

describe("proxy — public paths", () => {
  for (const p of ["/", "/auth/login", "/auth/verify", "/auth/request", "/auth/logout",
    "/api/health", "/api/auth/oidc", "/api/auth/oidc/callback", "/sitemap.xml"]) {
    it(`allows ${p} without auth`, () => expect(isPass(proxy(req(p)))).toBe(true));
  }
});

describe("proxy — static assets", () => {
  for (const p of ["/_next/static/chunk.js", "/_next/image?url=/x&w=64&q=75",
    "/favicon.ico", "/styles/main.css", "/script.js", "/img.svg", "/f.woff2"]) {
    it(`allows ${p}`, () => expect(isPass(proxy(req(p)))).toBe(true));
  }

  it("does NOT treat unknown extensions as static", () => {
    const r = proxy(req("/admin/export.csv"));
    expect(r.status).toBe(307);
    expect(redirectTo(r)!.pathname).toBe("/auth/login");
  });

  it("does NOT bypass auth for paths with arbitrary dots", () => {
    expect(proxy(req("/admin/user.settings")).status).toBe(307);
  });
});

describe("proxy — protected paths without session", () => {
  for (const p of ["/projects", "/profile", "/admin", "/dashboard"]) {
    it(`redirects ${p} to login`, () => {
      const r = proxy(req(p));
      expect(r.status).toBe(307);
      expect(redirectTo(r)!.pathname).toBe("/auth/login");
    });
  }

  it("includes original path as redirect param", () => {
    expect(redirectTo(proxy(req("/projects/456/edit")))!.searchParams.get("redirect")).toBe("/projects/456/edit");
  });

  it("redirects when session cookie is empty", () => {
    expect(proxy(req("/projects", "")).status).toBe(307);
  });
});

describe("proxy — protected paths with session", () => {
  for (const p of ["/projects", "/profile", "/projects/123/proposals"]) {
    it(`allows ${p} with valid session`, () => expect(isPass(proxy(req(p, validJwt())))).toBe(true));
  }
});

describe("proxy — JWT validation", () => {
  it("redirects for random string", () => expect(proxy(req("/projects", "not-a-jwt")).status).toBe(307));

  it("redirects for expired JWT", () => {
    const jwt = fakeJwt({ userId: "u1", type: "session", exp: Math.floor(Date.now() / 1000) - 3600 });
    expect(proxy(req("/projects", jwt)).status).toBe(307);
  });

  it("redirects for wrong token type", () => {
    const jwt = fakeJwt({ userId: "u1", type: "magic-link", exp: Math.floor(Date.now() / 1000) + 3600 });
    expect(proxy(req("/projects", jwt)).status).toBe(307);
  });

  it("redirects for missing userId", () => {
    const jwt = fakeJwt({ type: "session", exp: Math.floor(Date.now() / 1000) + 3600 });
    expect(proxy(req("/projects", jwt)).status).toBe(307);
  });

  it("redirects when base64 payload is corrupt (catch branch)", () => {
    expect(proxy(req("/projects", "aaa.!!!invalid.sig")).status).toBe(307);
  });

  it("allows a valid session JWT", () => expect(isPass(proxy(req("/projects", validJwt())))).toBe(true));

  it("allows JWT without exp (non-number exp skips expiry check)", () => {
    const jwt = fakeJwt({ userId: "u1", type: "session" });
    expect(isPass(proxy(req("/projects", jwt)))).toBe(true);
  });
});

describe("proxy — security headers", () => {
  it("sets HSTS on public paths", () => {
    expect(proxy(req("/")).headers.get("Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains");
  });

  it("sets HSTS on authenticated paths", () => {
    expect(proxy(req("/projects", validJwt())).headers.get("Strict-Transport-Security"))
      .toBe("max-age=63072000; includeSubDomains");
  });

  it("sets HSTS on redirect responses", () => {
    const r = proxy(req("/projects"));
    expect(r.status).toBe(307);
    expect(r.headers.get("Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains");
  });

  it("sets X-Frame-Options DENY", () => {
    expect(proxy(req("/")).headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("sets X-Content-Type-Options", () => {
    expect(proxy(req("/")).headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("sets CSP", () => {
    expect(proxy(req("/")).headers.get("Content-Security-Policy")).toContain("default-src 'self'");
  });

  it("sets Permissions-Policy", () => {
    expect(proxy(req("/")).headers.get("Permissions-Policy")).toContain("camera=()");
  });
});

describe("proxy — unknown + non-public API", () => {
  it("lets unknown paths through for Next.js 404", () => expect(isPass(proxy(req("/nonexistent")))).toBe(true));
  it("redirects /api/projects without session", () => expect(proxy(req("/api/projects")).status).toBe(307));
  it("allows /api/projects with valid session", () => expect(isPass(proxy(req("/api/projects", validJwt())))).toBe(true));
});
