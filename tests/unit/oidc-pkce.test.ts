import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn() } }));
import { generateCodeVerifier, buildAuthorizationUrl, exchangeCode } from "@/lib/oidc";
const discovery = { authorization_endpoint: "https://sso.example.invalid/authorize", token_endpoint: "https://sso.example.invalid/token", userinfo_endpoint: "https://sso.example.invalid/userinfo" };
const config = { issuer: "https://sso.example.invalid", clientId: "client", clientSecret: "secret", redirectUri: "https://app.example.invalid/callback" };
afterEach(() => vi.unstubAllGlobals());
describe("OidcPkce", () => {
  it("should generate unique verifiers with the RFC 7636 character set", () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateCodeVerifier()).not.toBe(verifier);
  });
  it("should send only the challenge to the authorization endpoint", () => {
    const verifier = generateCodeVerifier();
    const url = new URL(buildAuthorizationUrl(discovery, config, "state", verifier));
    expect(url.searchParams.get("code_challenge")).toBe(createHash("sha256").update(verifier).digest("base64url"));
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.has("code_verifier")).toBe(false);
  });
  it("should exchange the code with its private verifier", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ access_token: "access" })));
    vi.stubGlobal("fetch", fetchMock);
    await exchangeCode(discovery, config, "code", "verifier");
    const options = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    const body = new URLSearchParams(String(options.body));
    expect(body.get("code_verifier")).toBe("verifier");
    expect(body.get("client_secret")).toBe("secret");
  });
});
