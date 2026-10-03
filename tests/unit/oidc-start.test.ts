import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  set: vi.fn(),
  authorize: vi.fn(() => "https://sso.example.invalid/authorize"),
  config: vi.fn(() => ({ issuer: "https://sso.example.invalid" })),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.set }) }));
vi.mock("@/lib/oidc", () => ({ getOidcConfig: mocks.config, fetchDiscovery: async () => ({}), generateState: () => "state", generateCodeVerifier: () => "verifier", buildAuthorizationUrl: mocks.authorize }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { GET } from "@/app/api/auth/oidc/route";
beforeEach(() => vi.clearAllMocks());
describe("OidcStart", () => {
  it("should bind the state, private verifier and project destination to the login attempt", async () => {
    const response = await GET(new NextRequest("https://app.example.invalid/api/auth/oidc?redirect=%2Fp%2Fdemo"));
    expect(response.headers.get("location")).toBe("https://sso.example.invalid/authorize");
    expect(mocks.set).toHaveBeenCalledWith("oidc_state", "state", expect.objectContaining({ httpOnly: true, sameSite: "lax", maxAge: 600 }));
    expect(mocks.set).toHaveBeenCalledWith("oidc_verifier", "verifier", expect.objectContaining({ httpOnly: true }));
    expect(mocks.set).toHaveBeenCalledWith("oidc_redirect", "/p/demo", expect.objectContaining({ httpOnly: true }));
    expect(mocks.authorize).toHaveBeenCalledWith({}, { issuer: "https://sso.example.invalid" }, "state", "verifier");
  });
  it("should reject an external post-login destination", async () => {
    await GET(new NextRequest("https://app.example.invalid/api/auth/oidc?redirect=https%3A%2F%2Fexternal.invalid"));
    expect(mocks.set).toHaveBeenCalledWith("oidc_redirect", "/", expect.any(Object));
  });
});
