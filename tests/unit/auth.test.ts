import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import {
  generateMagicLinkToken,
  verifyMagicLinkToken,
  generateMagicLink,
  createSessionToken,
  verifySessionToken,
} from "@/lib/auth";

describe("Auth Library", () => {
  describe("generateMagicLinkToken", () => {
    it("should generate a valid JWT token for magic link", () => {
      const email = "test@example.com";
      const token = generateMagicLinkToken(email);

      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3); // JWT has 3 parts
    });

    it("should normalize email to lowercase and trim", () => {
      const email = "  TEST@EXAMPLE.COM  ";
      const token = generateMagicLinkToken(email);
      const verified = verifyMagicLinkToken(token);

      expect(verified).toBe("test@example.com");
    });
  });

  describe("verifyMagicLinkToken", () => {
    it("should verify a valid magic link token", () => {
      const email = "test@example.com";
      const token = generateMagicLinkToken(email);
      const verified = verifyMagicLinkToken(token);

      expect(verified).toBe(email);
    });

    it("should return null for invalid token", () => {
      const verified = verifyMagicLinkToken("invalid-token");

      expect(verified).toBeNull();
    });

    it("should return null for token with wrong type", () => {
      const sessionToken = createSessionToken("user-123", "test@example.com");
      const verified = verifyMagicLinkToken(sessionToken);

      expect(verified).toBeNull();
    });

    it("should return null for expired token", () => {
      const now = Math.floor(Date.now() / 1000);
      const expiredToken = jwt.sign(
        { email: "test@example.com", type: "magic-link" },
        process.env.JWT_SECRET!,
        {
          expiresIn: 1, // 1 second
          issuer: process.env.APP_URL,
          notBefore: now - 100, // issued 100 seconds ago
        }
      );

      // Wait for token to expire
      return new Promise((resolve) => {
        setTimeout(() => {
          const verified = verifyMagicLinkToken(expiredToken);
          expect(verified).toBeNull();
          resolve(undefined);
        }, 1100);
      });
    });
  });

  describe("generateMagicLink", () => {
    it("should generate a complete magic link URL", () => {
      const email = "test@example.com";
      const link = generateMagicLink(email);

      expect(link).toContain("http://localhost:3000/auth/verify?token=");
      expect(link).toContain(encodeURIComponent(".")); // JWT contains dots
    });

    it("should URL-encode the token", () => {
      const email = "test@example.com";
      const link = generateMagicLink(email);
      const url = new URL(link);
      const token = url.searchParams.get("token");

      expect(token).toBeTruthy();
      expect(verifyMagicLinkToken(token!)).toBe(email);
    });
  });

  describe("createSessionToken", () => {
    it("should create a valid session JWT token", () => {
      const userId = "user-123";
      const email = "test@example.com";
      const token = createSessionToken(userId, email);

      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3);
    });

    it("should include userId, email, and jti in payload", () => {
      const userId = "user-123";
      const email = "test@example.com";
      const token = createSessionToken(userId, email);

      // Decode without verification to inspect payload
      const decoded = jwt.decode(token) as any;

      expect(decoded).toBeTruthy();
      expect(decoded.userId).toBe(userId);
      expect(decoded.email).toBe(email);
      expect(decoded.type).toBe("session");
      expect(decoded.jti).toBeTruthy();
      expect(typeof decoded.jti).toBe("string");
    });

    it("should normalize email to lowercase", () => {
      const userId = "user-123";
      const email = "TEST@EXAMPLE.COM";
      const token = createSessionToken(userId, email);

      const decoded = jwt.decode(token) as any;
      expect(decoded.email).toBe("test@example.com");
    });
  });

  describe("verifySessionToken", () => {
    it("should verify a valid session token", () => {
      const userId = "user-123";
      const email = "test@example.com";
      const token = createSessionToken(userId, email);
      const payload = verifySessionToken(token);

      expect(payload).toBeTruthy();
      expect(payload?.userId).toBe(userId);
      expect(payload?.email).toBe(email);
      expect(payload?.type).toBe("session");
    });

    it("should return null for invalid token", () => {
      const payload = verifySessionToken("invalid-token");

      expect(payload).toBeNull();
    });

    it("should return null for token with wrong type", () => {
      const magicToken = generateMagicLinkToken("test@example.com");
      const payload = verifySessionToken(magicToken);

      expect(payload).toBeNull();
    });

    it("should return null for token with non-session type but valid audience/issuer", () => {
      const token = jwt.sign(
        { userId: "user-123", email: "test@example.com", type: "magic-link" },
        process.env.JWT_SECRET!,
        {
          expiresIn: "7d",
          issuer: process.env.APP_URL,
          audience: process.env.APP_URL,
          notBefore: Math.floor(Date.now() / 1000),
        }
      );
      const payload = verifySessionToken(token);
      expect(payload).toBeNull();
    });

    it("should return null for token with wrong audience", () => {
      const wrongAudienceToken = jwt.sign(
        { userId: "user-123", email: "test@example.com", type: "session", jti: "test-jti" },
        process.env.JWT_SECRET!,
        {
          expiresIn: "7d",
          issuer: process.env.APP_URL,
          audience: "http://wrong-url.com",
          notBefore: Math.floor(Date.now() / 1000)
        }
      );

      const payload = verifySessionToken(wrongAudienceToken);

      expect(payload).toBeNull();
    });
  });

  describe("JWT Security Requirements", () => {
    it("should include expiration time in session tokens", () => {
      const userId = "user-123";
      const email = "test@example.com";
      const token = createSessionToken(userId, email);

      const decoded = jwt.decode(token) as any;

      expect(decoded.exp).toBeTruthy();
      expect(typeof decoded.exp).toBe("number");

      // Token should expire in approximately 7 days
      const now = Math.floor(Date.now() / 1000);
      const expectedExpiry = now + 60 * 60 * 24 * 7; // 7 days
      expect(decoded.exp).toBeGreaterThan(now);
      expect(decoded.exp).toBeLessThanOrEqual(expectedExpiry + 10); // Allow 10 seconds tolerance
    });

    it("should include issued at time in session tokens", () => {
      const userId = "user-123";
      const email = "test@example.com";
      const token = createSessionToken(userId, email);

      const decoded = jwt.decode(token) as any;

      expect(decoded.iat).toBeTruthy();
      expect(typeof decoded.iat).toBe("number");

      const now = Math.floor(Date.now() / 1000);
      expect(decoded.iat).toBeLessThanOrEqual(now + 1); // Allow 1 second tolerance
    });

    it("should include not before time in session tokens", () => {
      const userId = "user-123";
      const email = "test@example.com";
      const token = createSessionToken(userId, email);

      const decoded = jwt.decode(token) as any;

      expect(decoded.nbf).toBeTruthy();
      expect(typeof decoded.nbf).toBe("number");

      const now = Math.floor(Date.now() / 1000);
      expect(decoded.nbf).toBeLessThanOrEqual(now + 1); // Allow 1 second tolerance
    });

    it("should include audience and issuer claims", () => {
      const userId = "user-123";
      const email = "test@example.com";
      const token = createSessionToken(userId, email);

      const decoded = jwt.decode(token) as any;

      expect(decoded.iss).toBe(process.env.APP_URL);
      expect(decoded.aud).toBe(process.env.APP_URL);
    });
  });
});
