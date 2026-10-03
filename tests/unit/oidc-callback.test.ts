import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  config: vi.fn(() => ({ issuer: "https://sso.example.com", clientId: "test", clientSecret: "test", redirectUri: "http://localhost/callback" })),
  discovery: vi.fn(async () => ({})),
  exchange: vi.fn(async () => ({ access_token: "access" })),
  info: vi.fn(async () => ({ sub: "subject", email: "member@example.invalid", given_name: "Demo", family_name: "Member" })),
  link: vi.fn(async () => ({ userId: "member", isNew: false })),
  session: vi.fn(async () => {}),
  cookieGet: vi.fn(() => ({ value: "expected-state" })),
  cookieDelete: vi.fn(),
}));
vi.mock("@/lib/oidc", () => ({ getOidcConfig: mocks.config, fetchDiscovery: mocks.discovery, exchangeCode: mocks.exchange, fetchUserInfo: mocks.info, findOrLinkOidcUser: mocks.link }));
vi.mock("@/lib/auth", () => ({ setSessionCookie: mocks.session }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.cookieGet, delete: mocks.cookieDelete }) }));
import { GET } from "@/app/api/auth/oidc/callback/route";

beforeEach(() => vi.clearAllMocks());
describe("OidcCallback", () => {
  it("should create the session and return to the primary landing page after successful SSO", async () => {
    const response = await GET(new NextRequest("http://localhost/api/auth/oidc/callback?code=code&state=expected-state"));
    expect(mocks.session).toHaveBeenCalledWith("member", "member@example.invalid");
    expect(mocks.cookieDelete).toHaveBeenCalledWith("oidc_state");
    expect(response.headers.get("location")).toBe("http://localhost/");
  });
  it("should reject an invalid state before exchanging credentials", async () => {
    const response = await GET(new NextRequest("http://localhost/api/auth/oidc/callback?code=code&state=other"));
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(mocks.session).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toContain("oidc_state_mismatch");
  });
});
