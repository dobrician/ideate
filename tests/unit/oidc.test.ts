import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: () => ({ from: mockFrom }),
    insert: () => ({ values: mockValues }),
  },
}));

vi.mock("@/db/schema", () => ({
  users: {},
  oauthAccounts: {},
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Import SUT ─────────────────────────────────────────────────────────────

import {
  getOidcConfig,
  fetchDiscovery,
  clearDiscoveryCache,
  generateState,
  buildAuthorizationUrl,
  exchangeCode,
  fetchUserInfo,
  findOrLinkOidcUser,
} from "@/lib/oidc";

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  clearDiscoveryCache();
  delete process.env.OIDC_ISSUER;
  delete process.env.OIDC_CLIENT_ID;
  delete process.env.OIDC_CLIENT_SECRET;
  delete process.env.OIDC_REDIRECT_URI;
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ limit: mockLimit });
  mockLimit.mockResolvedValue([]);
  mockValues.mockResolvedValue(undefined);
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("OIDC Library", () => {
  describe("getOidcConfig", () => {
    it("returns null when env vars are missing", () => {
      expect(getOidcConfig()).toBeNull();
    });

    it("returns null when only issuer is set", () => {
      process.env.OIDC_ISSUER = "https://accounts.google.com";
      expect(getOidcConfig()).toBeNull();
    });

    it("returns config when all required vars are set", () => {
      process.env.OIDC_ISSUER = "https://accounts.google.com";
      process.env.OIDC_CLIENT_ID = "test-id";
      process.env.OIDC_CLIENT_SECRET = "test-secret";
      process.env.APP_URL = "http://localhost:3000";

      const config = getOidcConfig();
      expect(config).not.toBeNull();
      expect(config!.issuer).toBe("https://accounts.google.com");
      expect(config!.clientId).toBe("test-id");
      expect(config!.redirectUri).toContain("/api/auth/oidc/callback");
    });

    it("falls back to http://localhost:3000 when both OIDC_REDIRECT_URI and APP_URL are unset", () => {
      process.env.OIDC_ISSUER = "https://accounts.google.com";
      process.env.OIDC_CLIENT_ID = "test-id";
      process.env.OIDC_CLIENT_SECRET = "test-secret";
      delete process.env.OIDC_REDIRECT_URI;
      delete process.env.APP_URL;

      const config = getOidcConfig();
      expect(config).not.toBeNull();
      expect(config!.redirectUri).toBe(
        "http://localhost:3000/api/auth/oidc/callback"
      );
    });

    it("uses custom redirect URI when set", () => {
      process.env.OIDC_ISSUER = "https://accounts.google.com";
      process.env.OIDC_CLIENT_ID = "test-id";
      process.env.OIDC_CLIENT_SECRET = "test-secret";
      process.env.OIDC_REDIRECT_URI = "https://custom.example.com/cb";

      const config = getOidcConfig();
      expect(config!.redirectUri).toBe("https://custom.example.com/cb");
    });
  });

  describe("generateState", () => {
    it("returns a hex string", () => {
      expect(generateState()).toMatch(/^[a-f0-9]{64}$/);
    });

    it("returns unique values", () => {
      const a = generateState();
      const b = generateState();
      expect(a).not.toBe(b);
    });
  });

  describe("buildAuthorizationUrl", () => {
    it("builds URL with correct params", () => {
      const discovery = {
        authorization_endpoint: "https://provider.com/authorize",
        token_endpoint: "https://provider.com/token",
        userinfo_endpoint: "https://provider.com/userinfo",
      };
      const config = {
        issuer: "https://provider.com",
        clientId: "cid",
        clientSecret: "csec",
        redirectUri: "http://localhost:3000/api/auth/oidc/callback",
      };

      const url = buildAuthorizationUrl(discovery, config, "test-state");
      expect(url).toContain("response_type=code");
      expect(url).toContain("client_id=cid");
      expect(url).toContain("state=test-state");
      expect(url).toContain("scope=openid+email+profile");
      expect(url.startsWith("https://provider.com/authorize?")).toBe(true);
    });
  });

  describe("fetchDiscovery", () => {
    const origFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = origFetch;
    });

    it("fetches and caches discovery document", async () => {
      let fetchCount = 0;
      globalThis.fetch = async () => {
        fetchCount++;
        return new Response(JSON.stringify({
          authorization_endpoint: "https://p.com/auth",
          token_endpoint: "https://p.com/token",
          userinfo_endpoint: "https://p.com/userinfo",
        }));
      };

      const d1 = await fetchDiscovery("https://p.com");
      expect(d1.authorization_endpoint).toBe("https://p.com/auth");
      expect(fetchCount).toBe(1);

      const d2 = await fetchDiscovery("https://p.com");
      expect(d2).toEqual(d1);
      expect(fetchCount).toBe(1); // cached
    });

    it("throws on non-OK response", async () => {
      globalThis.fetch = async () => new Response("err", { status: 500 });
      await expect(fetchDiscovery("https://p.com")).rejects.toThrow("discovery failed");
    });
  });

  describe("exchangeCode", () => {
    const origFetch = globalThis.fetch;
    const discovery = {
      authorization_endpoint: "https://p.com/auth",
      token_endpoint: "https://p.com/token",
      userinfo_endpoint: "https://p.com/userinfo",
    };
    const config = {
      issuer: "https://p.com",
      clientId: "cid",
      clientSecret: "csec",
      redirectUri: "http://localhost:3000/cb",
    };

    afterEach(() => {
      globalThis.fetch = origFetch;
    });

    it("exchanges code for tokens", async () => {
      globalThis.fetch = async (_url, init) => {
        expect(init?.method).toBe("POST");
        return new Response(JSON.stringify({ access_token: "at", token_type: "Bearer" }));
      };
      const tokens = await exchangeCode(discovery, config, "auth-code");
      expect(tokens.access_token).toBe("at");
    });

    it("throws on failure", async () => {
      globalThis.fetch = async () => new Response("bad", { status: 400 });
      await expect(exchangeCode(discovery, config, "bad")).rejects.toThrow("Token exchange failed");
    });
  });

  describe("fetchUserInfo", () => {
    const origFetch = globalThis.fetch;
    const discovery = {
      authorization_endpoint: "https://p.com/auth",
      token_endpoint: "https://p.com/token",
      userinfo_endpoint: "https://p.com/userinfo",
    };

    afterEach(() => {
      globalThis.fetch = origFetch;
    });

    it("fetches user info with bearer token", async () => {
      globalThis.fetch = async (_url, init) => {
        const headers = init?.headers as Record<string, string>;
        expect(headers.Authorization).toBe("Bearer at123");
        return new Response(JSON.stringify({ sub: "u1", email: "a@b.com" }));
      };
      const info = await fetchUserInfo(discovery, "at123");
      expect(info.sub).toBe("u1");
      expect(info.email).toBe("a@b.com");
    });

    it("throws on non-OK response", async () => {
      globalThis.fetch = async () => new Response("err", { status: 401 });
      await expect(fetchUserInfo(discovery, "bad")).rejects.toThrow("UserInfo failed");
    });
  });

  describe("findOrLinkOidcUser", () => {
    it("returns existing linked account", async () => {
      mockLimit.mockResolvedValueOnce([{ userId: "existing-user" }]);
      const result = await findOrLinkOidcUser("google", "sub1", "a@b.com", {});
      expect(result).toEqual({ userId: "existing-user", isNew: false });
    });

    it("links to existing user by email", async () => {
      // First query (oauthAccounts) — no match
      mockLimit.mockResolvedValueOnce([]);
      // Second query (users) — found by email
      mockLimit.mockResolvedValueOnce([{ id: "email-user" }]);

      const result = await findOrLinkOidcUser("google", "sub2", "a@b.com", {});
      expect(result).toEqual({ userId: "email-user", isNew: false });
      expect(mockValues).toHaveBeenCalled();
    });

    it("creates new user when no match found", async () => {
      // First query (oauthAccounts) — no match
      mockLimit.mockResolvedValueOnce([]);
      // Second query (users) — no match
      mockLimit.mockResolvedValueOnce([]);

      const result = await findOrLinkOidcUser("google", "sub3", "new@b.com", {
        firstName: "John",
        lastName: "Doe",
      });
      expect(result.isNew).toBe(true);
      expect(result.userId).toBeTruthy();
      // Should insert both user and oauth account
      expect(mockValues).toHaveBeenCalledTimes(2);
    });

    it("generates fallback email when none provided", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const result = await findOrLinkOidcUser("github", "sub4", undefined, {});
      expect(result.isNew).toBe(true);
      expect(mockValues).toHaveBeenCalledTimes(2);
    });
  });
});
