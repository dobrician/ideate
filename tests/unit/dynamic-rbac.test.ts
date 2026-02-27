import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db before importing module
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/db/schema", () => ({
  permissionRules: { id: "id", active: "active", startsAt: "starts_at", expiresAt: "expires_at", targetType: "target_type", targetId: "target_id", permission: "permission", effect: "effect", ruleType: "rule_type", schedule: "schedule", condition: "condition", entityType: "entity_type", entityId: "entity_id" },
  resourceAcls: { id: "id", entityType: "entity_type", entityId: "entity_id", granteeType: "grantee_type", granteeId: "grantee_id", permission: "permission", effect: "effect", expiresAt: "expires_at" },
}));

// Import after mocks
import {
  isScheduleActive,
  evaluateCondition,
  doesRuleApply,
  type PermissionContext,
  type ScheduleConfig,
  type ConditionConfig,
} from "@/lib/rbac/dynamic";

describe("Dynamic RBAC Engine", () => {
  // ─── Schedule Evaluation ──────────────────────────────────────────

  describe("isScheduleActive", () => {
    it("returns true when current day and hour match", () => {
      const now = new Date();
      const schedule: ScheduleConfig = {
        days: [now.getDay()],
        startHour: 0,
        endHour: 24,
      };
      expect(isScheduleActive(schedule)).toBe(true);
    });

    it("returns false when day does not match", () => {
      const now = new Date();
      const wrongDay = (now.getDay() + 3) % 7;
      const schedule: ScheduleConfig = {
        days: [wrongDay],
        startHour: 0,
        endHour: 24,
      };
      expect(isScheduleActive(schedule)).toBe(false);
    });

    it("handles business hours (9-17)", () => {
      const now = new Date();
      const hour = now.getHours();
      const schedule: ScheduleConfig = {
        days: [now.getDay()],
        startHour: 9,
        endHour: 17,
      };
      const expected = hour >= 9 && hour < 17;
      expect(isScheduleActive(schedule)).toBe(expected);
    });

    it("handles overnight schedules (22-06)", () => {
      const now = new Date();
      const hour = now.getHours();
      const schedule: ScheduleConfig = {
        days: [now.getDay()],
        startHour: 22,
        endHour: 6,
      };
      const expected = hour >= 22 || hour < 6;
      expect(isScheduleActive(schedule)).toBe(expected);
    });

    it("handles invalid timezone gracefully", () => {
      const now = new Date();
      const schedule: ScheduleConfig = {
        days: [now.getDay()],
        startHour: 0,
        endHour: 24,
        timezone: "Invalid/Zone",
      };
      // Should not throw, falls back
      expect(typeof isScheduleActive(schedule)).toBe("boolean");
    });
  });

  // ─── Condition Evaluation ─────────────────────────────────────────

  describe("evaluateCondition", () => {
    const baseCtx: PermissionContext = {
      userId: "user-1",
      userRole: "member",
      permission: "vote:cast",
    };

    it("evaluates vote_count >= threshold", () => {
      const cond: ConditionConfig = { type: "vote_count", operator: ">=", value: 10 };
      expect(evaluateCondition(cond, { ...baseCtx, voteCount: 15 })).toBe(true);
      expect(evaluateCondition(cond, { ...baseCtx, voteCount: 10 })).toBe(true);
      expect(evaluateCondition(cond, { ...baseCtx, voteCount: 5 })).toBe(false);
    });

    it("evaluates vote_count <= threshold", () => {
      const cond: ConditionConfig = { type: "vote_count", operator: "<=", value: 5 };
      expect(evaluateCondition(cond, { ...baseCtx, voteCount: 3 })).toBe(true);
      expect(evaluateCondition(cond, { ...baseCtx, voteCount: 8 })).toBe(false);
    });

    it("evaluates vote_count == threshold", () => {
      const cond: ConditionConfig = { type: "vote_count", operator: "==", value: 5 };
      expect(evaluateCondition(cond, { ...baseCtx, voteCount: 5 })).toBe(true);
      expect(evaluateCondition(cond, { ...baseCtx, voteCount: 6 })).toBe(false);
    });

    it("evaluates vote_count > threshold", () => {
      const cond: ConditionConfig = { type: "vote_count", operator: ">", value: 10 };
      expect(evaluateCondition(cond, { ...baseCtx, voteCount: 11 })).toBe(true);
      expect(evaluateCondition(cond, { ...baseCtx, voteCount: 10 })).toBe(false);
    });

    it("evaluates vote_count < threshold", () => {
      const cond: ConditionConfig = { type: "vote_count", operator: "<", value: 3 };
      expect(evaluateCondition(cond, { ...baseCtx, voteCount: 2 })).toBe(true);
      expect(evaluateCondition(cond, { ...baseCtx, voteCount: 3 })).toBe(false);
    });

    it("defaults to 0 when voteCount missing", () => {
      const cond: ConditionConfig = { type: "vote_count", operator: ">=", value: 0 };
      expect(evaluateCondition(cond, baseCtx)).toBe(true);
    });

    it("evaluates authorship_window within window", () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const cond: ConditionConfig = { type: "authorship_window", operator: "<=", value: 24 };
      const ctx: PermissionContext = {
        ...baseCtx,
        resourceOwnerId: "user-1",
        resourceCreatedAt: nowSec - 3600, // 1 hour ago
      };
      expect(evaluateCondition(cond, ctx)).toBe(true);
    });

    it("evaluates authorship_window outside window", () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const cond: ConditionConfig = { type: "authorship_window", operator: "<=", value: 1 };
      const ctx: PermissionContext = {
        ...baseCtx,
        resourceOwnerId: "user-1",
        resourceCreatedAt: nowSec - 7200, // 2 hours ago
      };
      expect(evaluateCondition(cond, ctx)).toBe(false);
    });

    it("fails authorship_window if not the owner", () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const cond: ConditionConfig = { type: "authorship_window", operator: "<=", value: 24 };
      const ctx: PermissionContext = {
        ...baseCtx,
        resourceOwnerId: "other-user",
        resourceCreatedAt: nowSec - 3600,
      };
      expect(evaluateCondition(cond, ctx)).toBe(false);
    });

    it("fails authorship_window if no createdAt", () => {
      const cond: ConditionConfig = { type: "authorship_window", operator: "<=", value: 24 };
      const ctx: PermissionContext = {
        ...baseCtx,
        resourceOwnerId: "user-1",
      };
      expect(evaluateCondition(cond, ctx)).toBe(false);
    });

    it("returns false for unknown condition type", () => {
      const cond = { type: "unknown", operator: ">=", value: 5 } as ConditionConfig;
      expect(evaluateCondition(cond, baseCtx)).toBe(false);
    });

    it("returns false for unknown operator", () => {
      const cond = { type: "vote_count", operator: "!!" as ">=", value: 5 };
      expect(evaluateCondition(cond, baseCtx)).toBe(false);
    });
  });

  // ─── Rule Application ────────────────────────────────────────────

  describe("doesRuleApply", () => {
    const baseRule = {
      id: "rule-1",
      name: "Test Rule",
      description: null,
      ruleType: "time_expiry" as const,
      targetType: "role" as const,
      targetId: "member",
      permission: "vote:cast",
      effect: "grant" as const,
      startsAt: null,
      expiresAt: null,
      schedule: null,
      condition: null,
      entityType: null,
      entityId: null,
      active: true,
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const baseCtx: PermissionContext = {
      userId: "user-1",
      userRole: "member",
      permission: "vote:cast",
    };

    it("matches when permission equals", () => {
      expect(doesRuleApply(baseRule, baseCtx)).toBe(true);
    });

    it("rejects when permission differs", () => {
      expect(doesRuleApply(baseRule, { ...baseCtx, permission: "project:create" })).toBe(false);
    });

    it("rejects when entity scope does not match", () => {
      const rule = { ...baseRule, entityType: "project" as const, entityId: "proj-1" };
      expect(doesRuleApply(rule, baseCtx)).toBe(false);
      expect(doesRuleApply(rule, { ...baseCtx, entityType: "project", entityId: "proj-1" })).toBe(true);
    });

    it("evaluates schedule-type rules", () => {
      const now = new Date();
      const rule = {
        ...baseRule,
        ruleType: "schedule" as const,
        schedule: JSON.stringify({ days: [now.getDay()], startHour: 0, endHour: 24 }),
      };
      expect(doesRuleApply(rule, baseCtx)).toBe(true);
    });

    it("rejects schedule rule when outside schedule", () => {
      const now = new Date();
      const wrongDay = (now.getDay() + 3) % 7;
      const rule = {
        ...baseRule,
        ruleType: "schedule" as const,
        schedule: JSON.stringify({ days: [wrongDay], startHour: 0, endHour: 24 }),
      };
      expect(doesRuleApply(rule, baseCtx)).toBe(false);
    });

    it("handles malformed schedule JSON gracefully", () => {
      const rule = { ...baseRule, ruleType: "schedule" as const, schedule: "not json" };
      expect(doesRuleApply(rule, baseCtx)).toBe(false);
    });

    it("evaluates condition-type rules", () => {
      const rule = {
        ...baseRule,
        ruleType: "condition" as const,
        condition: JSON.stringify({ type: "vote_count", operator: ">=", value: 5 }),
      };
      expect(doesRuleApply(rule, { ...baseCtx, voteCount: 10 })).toBe(true);
      expect(doesRuleApply(rule, { ...baseCtx, voteCount: 2 })).toBe(false);
    });

    it("handles malformed condition JSON gracefully", () => {
      const rule = { ...baseRule, ruleType: "condition" as const, condition: "not json" };
      expect(doesRuleApply(rule, baseCtx)).toBe(false);
    });
  });
});
