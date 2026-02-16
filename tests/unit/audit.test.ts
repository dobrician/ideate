import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockInsertValues = vi.fn();

vi.mock("@/db", () => ({
  db: {
    insert: () => ({
      values: (...args: unknown[]) => {
        mockInsertValues(...args);
        return Promise.resolve();
      },
    }),
  },
}));

// ── Import SUT ─────────────────────────────────────────────────────────────

import { logAudit } from "@/lib/audit";

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockInsertValues.mockClear();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Audit Library", () => {
  describe("logAudit", () => {
    it("should log a complete audit entry with all fields", async () => {
      await logAudit({
        userId: "user-123",
        action: "create",
        entity: "proposal",
        entityId: "prop-456",
        details: "Created proposal: My New Idea",
        ipAddress: "192.168.1.1",
      });

      expect(mockInsertValues).toHaveBeenCalledWith({
        userId: "user-123",
        action: "create",
        entity: "proposal",
        entityId: "prop-456",
        details: "Created proposal: My New Idea",
        ipAddress: "192.168.1.1",
      });
    });

    it("should log audit entry with null userId for anonymous actions", async () => {
      await logAudit({
        userId: null,
        action: "login",
        entity: "session",
      });

      expect(mockInsertValues).toHaveBeenCalledWith({
        userId: null,
        action: "login",
        entity: "session",
        entityId: null,
        details: null,
        ipAddress: null,
      });
    });

    it("should convert undefined optional fields to null", async () => {
      await logAudit({
        userId: "user-123",
        action: "vote",
        entity: "vote",
      });

      expect(mockInsertValues).toHaveBeenCalledWith({
        userId: "user-123",
        action: "vote",
        entity: "vote",
        entityId: null,
        details: null,
        ipAddress: null,
      });
    });

    it("should log update actions", async () => {
      await logAudit({
        userId: "user-123",
        action: "update",
        entity: "project",
        entityId: "proj-789",
        details: "Updated project title",
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "update",
          entity: "project",
        })
      );
    });

    it("should log delete actions", async () => {
      await logAudit({
        userId: "admin-1",
        action: "delete",
        entity: "proposal",
        entityId: "prop-999",
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "delete",
          entity: "proposal",
          entityId: "prop-999",
        })
      );
    });

    it("should log login actions for session tracking", async () => {
      await logAudit({
        userId: "user-123",
        action: "login",
        entity: "session",
        ipAddress: "10.0.0.5",
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "login",
          entity: "session",
          ipAddress: "10.0.0.5",
        })
      );
    });

    it("should log logout actions", async () => {
      await logAudit({
        userId: "user-123",
        action: "logout",
        entity: "session",
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "logout",
          entity: "session",
        })
      );
    });

    it("should log vote actions with proposal details", async () => {
      await logAudit({
        userId: "user-123",
        action: "vote",
        entity: "vote",
        entityId: "vote-id-1",
        details: "Voted +1 on proposal prop-456",
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "vote",
          entity: "vote",
          details: "Voted +1 on proposal prop-456",
        })
      );
    });

    it("should log unvote actions", async () => {
      await logAudit({
        userId: "user-123",
        action: "unvote",
        entity: "vote",
        details: "Removed vote from proposal prop-456",
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "unvote",
          entity: "vote",
        })
      );
    });

    it("should log comment actions", async () => {
      await logAudit({
        userId: "user-123",
        action: "comment",
        entity: "comment",
        entityId: "comment-789",
        details: "Commented on proposal prop-456",
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "comment",
          entity: "comment",
        })
      );
    });

    it("should never throw even when database insert fails", async () => {
      mockInsertValues.mockRejectedValue(new Error("DB constraint violation"));

      // Should not throw
      await expect(
        logAudit({
          userId: "user-123",
          action: "create",
          entity: "project",
        })
      ).resolves.toBeUndefined();
    });

    it("should never throw when database is unavailable", async () => {
      mockInsertValues.mockRejectedValue(new Error("ECONNREFUSED"));

      // Should not throw
      await expect(
        logAudit({
          userId: "user-123",
          action: "delete",
          entity: "proposal",
        })
      ).resolves.toBeUndefined();
    });

    it("should handle network timeout gracefully", async () => {
      mockInsertValues.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Timeout")), 1);
        });
      });

      // Should not throw
      await expect(
        logAudit({
          userId: "user-123",
          action: "update",
          entity: "user",
        })
      ).resolves.toBeUndefined();
    });

    it("should log multiple audit entries in sequence", async () => {
      await logAudit({
        userId: "user-1",
        action: "create",
        entity: "project",
        entityId: "proj-1",
      });

      await logAudit({
        userId: "user-2",
        action: "create",
        entity: "proposal",
        entityId: "prop-1",
      });

      await logAudit({
        userId: "user-3",
        action: "vote",
        entity: "vote",
        entityId: "vote-1",
      });

      expect(mockInsertValues).toHaveBeenCalledTimes(3);
    });

    it("should handle IP addresses in different formats", async () => {
      // IPv4
      await logAudit({
        userId: "user-1",
        action: "login",
        entity: "session",
        ipAddress: "192.168.1.1",
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: "192.168.1.1",
        })
      );

      // IPv6
      await logAudit({
        userId: "user-2",
        action: "login",
        entity: "session",
        ipAddress: "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
        })
      );
    });

    it("should handle very long details strings", async () => {
      const longDetails = "x".repeat(1000);

      await logAudit({
        userId: "user-123",
        action: "update",
        entity: "proposal",
        details: longDetails,
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          details: longDetails,
        })
      );
    });

    it("should handle special characters in details", async () => {
      await logAudit({
        userId: "user-123",
        action: "create",
        entity: "comment",
        details: 'Special chars: <>&"\'\n\t',
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          details: 'Special chars: <>&"\'\n\t',
        })
      );
    });
  });
});
