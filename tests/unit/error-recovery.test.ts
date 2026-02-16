import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifySessionToken, verifyMagicLinkToken } from "@/lib/auth";
import { escapeHtml, stripHtml } from "@/lib/sanitize";
import { subscribeVotes, emitVoteChange } from "@/lib/vote-events";
import { checkRateLimit, resetRateLimits } from "@/lib/rate-limit";
import jwt from "jsonwebtoken";

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Error Recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("SMTP send failure", () => {
    it("should throw descriptive error when SMTP send fails", async () => {
      const { sendMagicLinkEmail } = await import("@/lib/mail");

      // sendMagicLinkEmail should throw with a descriptive message
      await expect(
        sendMagicLinkEmail("test@example.com", "https://example.com/verify")
      ).rejects.toThrow("Failed to send email");
    });

    it("should handle SMTP verification failure gracefully", async () => {
      const { verifySmtpConnection } = await import("@/lib/mail");

      // verifySmtpConnection returns false on failure, does not throw
      const result = await verifySmtpConnection();
      expect(result).toBe(false);
    });
  });

  describe("AI API timeout", () => {
    it("should handle API timeout with fallback summary", async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error("ETIMEDOUT"));

      const { buildProposalSummary } = await import("@/lib/ai");

      const result = await buildProposalSummary(
        "Test Proposal",
        "A test proposal description that is long enough"
      );

      // Should either return a fallback summary or null, not crash
      expect(result === null || typeof result === "string").toBe(true);

      global.fetch = originalFetch;
    });

    it("should handle 429 rate limit from AI provider", async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve("Rate limited"),
      });

      const { buildProposalSummary } = await import("@/lib/ai");

      const result = await buildProposalSummary(
        "Test Proposal",
        "A test proposal"
      );

      expect(result === null || typeof result === "string").toBe(true);

      global.fetch = originalFetch;
    });

    it("should handle 500 server error from AI provider", async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      });

      const { buildProposalSummary } = await import("@/lib/ai");

      const result = await buildProposalSummary(
        "Test Proposal",
        "Description of the proposal"
      );

      expect(result === null || typeof result === "string").toBe(true);

      global.fetch = originalFetch;
    });
  });

  describe("Invalid JWT", () => {
    it("should return null for malformed session token", () => {
      const result = verifySessionToken("not.a.valid.jwt.token");
      expect(result).toBeNull();
    });

    it("should return null for empty session token", () => {
      const result = verifySessionToken("");
      expect(result).toBeNull();
    });

    it("should return null for malformed magic link token", () => {
      const result = verifyMagicLinkToken("garbage-token");
      expect(result).toBeNull();
    });

    it("should return null for expired magic link token", () => {
      const expiredToken = jwt.sign(
        {
          sub: "test@example.com",
          type: "magic-link",
          aud: process.env.APP_URL || "http://localhost:3000",
          iss: process.env.APP_URL || "http://localhost:3000",
          jti: "test-id",
        },
        process.env.JWT_SECRET || "test-secret-that-is-at-least-32-chars-long!!",
        { expiresIn: "-1h" }
      );

      const result = verifyMagicLinkToken(expiredToken);
      expect(result).toBeNull();
    });

    it("should return null for session token with wrong secret", () => {
      const token = jwt.sign(
        {
          sub: "user-1",
          email: "test@example.com",
          type: "session",
        },
        "wrong-secret-that-is-at-least-32-chars-long!!!",
        { expiresIn: "1h" }
      );

      const result = verifySessionToken(token);
      expect(result).toBeNull();
    });
  });

  describe("Vote events error handling", () => {
    it("should handle subscription to non-existent project gracefully", () => {
      const unsubscribe = subscribeVotes("non-existent-project", () => {});
      expect(typeof unsubscribe).toBe("function");

      expect(() =>
        emitVoteChange({
          proposalId: "p1",
          projectId: "non-existent-project",
          upvotes: 1,
          downvotes: 0,
        })
      ).not.toThrow();

      unsubscribe();
    });

    it("should handle multiple rapid subscribe/unsubscribe cycles", () => {
      for (let i = 0; i < 10; i++) {
        const unsub = subscribeVotes(`project-${i}`, () => {});
        unsub();
      }
      // Should not throw or leak memory
    });
  });

  describe("Rate limiter under stress", () => {
    it("should handle rapid successive requests without crashing", () => {
      resetRateLimits();

      for (let i = 0; i < 100; i++) {
        const result = checkRateLimit(`stress-${i % 5}`, 10, 60000);
        expect(result).toHaveProperty("allowed");
        expect(result).toHaveProperty("remaining");
        expect(result).toHaveProperty("retryAfterMs");
      }

      resetRateLimits();
    });
  });

  describe("Sanitization edge cases", () => {
    it("should handle empty inputs without crashing", () => {
      expect(escapeHtml("")).toBe("");
      expect(stripHtml("")).toBe("");
    });

    it("should neutralize XSS payloads", () => {
      expect(escapeHtml("<script>alert('xss')</script>")).not.toContain("<script>");
      expect(stripHtml("<img onerror='alert(1)' src='x'>")).not.toContain("<img");
    });
  });
});
