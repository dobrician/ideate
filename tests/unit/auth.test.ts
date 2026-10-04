import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import {
  createSessionToken,
  verifySessionToken,
} from "@/lib/auth";

describe("Auth Library", () => {

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
      const decoded = jwt.decode(token) as jwt.JwtPayload;

      expect(decoded).toBeTruthy();
      expect(decoded.userId).toBe(userId);
      expect(decoded.email).toBe(email);
      expect(decoded.type).toBe("session");
      expect(decoded.authMethod).toBe("sso");
      expect(decoded.jti).toBeTruthy();
      expect(typeof decoded.jti).toBe("string");
    });

    it("should normalize email to lowercase", () => {
      const userId = "user-123";
      const email = "TEST@EXAMPLE.COM";
      const token = createSessionToken(userId, email);

      const decoded = jwt.decode(token) as jwt.JwtPayload;
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

    it("should reject sessions issued before SSO-only authentication", () => {
      const token = jwt.sign({ userId: "user-123", email: "test@example.com", type: "session", jti: "legacy" }, process.env.JWT_SECRET!, { expiresIn: "7d", issuer: process.env.APP_URL, audience: process.env.APP_URL });
      expect(verifySessionToken(token)).toBeNull();
    });

    it("should return null for invalid token", () => {
      const payload = verifySessionToken("invalid-token");

      expect(payload).toBeNull();
    });

    it("should return null for token with wrong type", () => {
      const magicToken = jwt.sign({ email: "test@example.com", type: "magic-link" }, process.env.JWT_SECRET!, { issuer: process.env.APP_URL, audience: process.env.APP_URL });
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
        { userId: "user-123", email: "test@example.com", type: "session", authMethod: "sso", jti: "test-jti" },
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

      const decoded = jwt.decode(token) as jwt.JwtPayload;

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

      const decoded = jwt.decode(token) as jwt.JwtPayload;

      expect(decoded.iat).toBeTruthy();
      expect(typeof decoded.iat).toBe("number");

      const now = Math.floor(Date.now() / 1000);
      expect(decoded.iat).toBeLessThanOrEqual(now + 1); // Allow 1 second tolerance
    });

    it("should include not before time in session tokens", () => {
      const userId = "user-123";
      const email = "test@example.com";
      const token = createSessionToken(userId, email);

      const decoded = jwt.decode(token) as jwt.JwtPayload;

      expect(decoded.nbf).toBeTruthy();
      expect(typeof decoded.nbf).toBe("number");

      const now = Math.floor(Date.now() / 1000);
      expect(decoded.nbf).toBeLessThanOrEqual(now + 1); // Allow 1 second tolerance
    });

    it("should include audience and issuer claims", () => {
      const userId = "user-123";
      const email = "test@example.com";
      const token = createSessionToken(userId, email);

      const decoded = jwt.decode(token) as jwt.JwtPayload;

      expect(decoded.iss).toBe(process.env.APP_URL);
      expect(decoded.aud).toBe(process.env.APP_URL);
    });
  });

  describe("APP_URL fallback", () => {
    it("should use localhost:3000 when APP_URL is unset", async () => {
      const originalAppUrl = process.env.APP_URL;
      delete process.env.APP_URL;

      try {
        const payload = jwt.decode(createSessionToken("u", "test@example.com")) as jwt.JwtPayload;
        expect(payload.iss).toBe("http://localhost:3000");
      } finally {
        if (originalAppUrl !== undefined) {
          process.env.APP_URL = originalAppUrl;
        }
      }
    });
  });
});
