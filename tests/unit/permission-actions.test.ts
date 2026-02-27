/**
 * Unit tests for permission server actions (Sprint 56).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockUser = { id: "user-1", email: "admin@test.com", role: "admin" };
const mockWithActionAuth = vi.fn();

vi.mock("@/lib/action-wrapper", () => ({
  withActionAuth: (...args: unknown[]) => mockWithActionAuth(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

const mockInsertValues = vi.fn().mockResolvedValue(undefined);
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });
const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
const mockDbDelete = vi.fn().mockReturnValue({ where: mockDeleteWhere });
const mockUpdateSetWhere = vi.fn().mockResolvedValue(undefined);
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateSetWhere });
const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });
const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockSelectFrom });

vi.mock("@/db", () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  permissionRules: {},
  resourceAcls: {},
}));

vi.mock("@/lib/rbac/dynamic", () => ({
  simulatePermission: vi.fn().mockResolvedValue({
    finalResult: { allowed: true, reason: "Allowed by role" },
    matchingRules: [],
    matchingAcls: [],
    staticRbac: true,
  }),
}));

// ── Import after mocks ────────────────────────────────────────────────────

import {
  createPermissionRuleAction,
  deletePermissionRuleAction,
  updatePermissionRuleAction,
  createResourceAclAction,
  deleteResourceAclAction,
  simulatePermissionAction,
} from "@/app/admin/permission-actions";

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: withActionAuth calls handler immediately
  mockWithActionAuth.mockImplementation(
    async (_csrf: string, _opts: unknown, handler: (u: typeof mockUser) => Promise<unknown>) => {
      return handler(mockUser);
    },
  );
  mockSelectWhere.mockResolvedValue([{ id: "existing-1", name: "Test", permission: "vote:cast", entityType: "project", entityId: "p1", granteeId: "user-1" }]);
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Permission Actions", () => {
  describe("createPermissionRuleAction", () => {
    it("creates a rule with valid input", async () => {
      const res = await createPermissionRuleAction({
        name: "Test Rule",
        ruleType: "time_expiry",
        targetType: "role",
        targetId: "member",
        permission: "vote:cast",
        effect: "grant",
      }, "csrf");
      expect(res).toHaveProperty("success", true);
      expect(res).toHaveProperty("id");
      expect(mockInsert).toHaveBeenCalled();
    });

    it("rejects empty name", async () => {
      const res = await createPermissionRuleAction({
        name: "",
        ruleType: "time_expiry",
        targetType: "role",
        targetId: "member",
        permission: "vote:cast",
        effect: "grant",
      }, "csrf");
      expect(res).toHaveProperty("error");
    });

    it("rejects invalid permission", async () => {
      const res = await createPermissionRuleAction({
        name: "Test",
        ruleType: "time_expiry",
        targetType: "role",
        targetId: "member",
        permission: "fake:permission",
        effect: "grant",
      }, "csrf");
      expect(res).toHaveProperty("error", "Invalid permission");
    });

    it("rejects invalid rule type", async () => {
      const res = await createPermissionRuleAction({
        name: "Test",
        ruleType: "invalid" as "time_expiry",
        targetType: "role",
        targetId: "member",
        permission: "vote:cast",
        effect: "grant",
      }, "csrf");
      expect(res).toHaveProperty("error", "Invalid rule type");
    });

    it("rejects invalid target type", async () => {
      const res = await createPermissionRuleAction({
        name: "Test",
        ruleType: "time_expiry",
        targetType: "invalid" as "user",
        permission: "vote:cast",
        effect: "grant",
      }, "csrf");
      expect(res).toHaveProperty("error", "Invalid target type");
    });

    it("rejects invalid effect", async () => {
      const res = await createPermissionRuleAction({
        name: "Test",
        ruleType: "time_expiry",
        targetType: "role",
        permission: "vote:cast",
        effect: "invalid" as "grant",
      }, "csrf");
      expect(res).toHaveProperty("error", "Invalid effect");
    });

    it("handles expiry timestamp", async () => {
      const futureMs = Date.now() + 86400000;
      const res = await createPermissionRuleAction({
        name: "Expiring Rule",
        ruleType: "time_expiry",
        targetType: "all",
        permission: "vote:cast",
        effect: "deny",
        expiresAt: futureMs,
      }, "csrf");
      expect(res).toHaveProperty("success", true);
    });
  });

  describe("updatePermissionRuleAction", () => {
    it("updates rule active status", async () => {
      const res = await updatePermissionRuleAction("rule-1", { active: false }, "csrf");
      expect(res).toHaveProperty("success", true);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("rejects missing rule ID", async () => {
      const res = await updatePermissionRuleAction("", { active: false }, "csrf");
      expect(res).toHaveProperty("error", "Rule ID required");
    });

    it("rejects non-existent rule", async () => {
      mockSelectWhere.mockResolvedValueOnce([]);
      const res = await updatePermissionRuleAction("missing", { active: false }, "csrf");
      expect(res).toHaveProperty("error", "Rule not found");
    });
  });

  describe("deletePermissionRuleAction", () => {
    it("deletes an existing rule", async () => {
      const res = await deletePermissionRuleAction("rule-1", "csrf");
      expect(res).toHaveProperty("success", true);
      expect(mockDbDelete).toHaveBeenCalled();
    });

    it("rejects missing rule ID", async () => {
      const res = await deletePermissionRuleAction("", "csrf");
      expect(res).toHaveProperty("error", "Rule ID required");
    });

    it("rejects non-existent rule", async () => {
      mockSelectWhere.mockResolvedValueOnce([]);
      const res = await deletePermissionRuleAction("missing", "csrf");
      expect(res).toHaveProperty("error", "Rule not found");
    });
  });

  describe("createResourceAclAction", () => {
    it("creates an ACL entry", async () => {
      const res = await createResourceAclAction({
        entityType: "project",
        entityId: "proj-1",
        granteeType: "user",
        granteeId: "user-2",
        permission: "project:update",
        effect: "grant",
      }, "csrf");
      expect(res).toHaveProperty("success", true);
      expect(mockInsert).toHaveBeenCalled();
    });

    it("rejects missing entity ID", async () => {
      const res = await createResourceAclAction({
        entityType: "project",
        entityId: "",
        granteeType: "user",
        granteeId: "user-2",
        permission: "project:update",
        effect: "grant",
      }, "csrf");
      expect(res).toHaveProperty("error");
    });

    it("rejects missing grantee ID", async () => {
      const res = await createResourceAclAction({
        entityType: "project",
        entityId: "proj-1",
        granteeType: "user",
        granteeId: "",
        permission: "project:update",
        effect: "grant",
      }, "csrf");
      expect(res).toHaveProperty("error");
    });

    it("rejects invalid permission", async () => {
      const res = await createResourceAclAction({
        entityType: "project",
        entityId: "proj-1",
        granteeType: "user",
        granteeId: "user-2",
        permission: "invalid:perm",
        effect: "grant",
      }, "csrf");
      expect(res).toHaveProperty("error", "Invalid permission");
    });
  });

  describe("deleteResourceAclAction", () => {
    it("deletes an existing ACL", async () => {
      const res = await deleteResourceAclAction("acl-1", "csrf");
      expect(res).toHaveProperty("success", true);
      expect(mockDbDelete).toHaveBeenCalled();
    });

    it("rejects missing ACL ID", async () => {
      const res = await deleteResourceAclAction("", "csrf");
      expect(res).toHaveProperty("error", "ACL ID required");
    });

    it("rejects non-existent ACL", async () => {
      mockSelectWhere.mockResolvedValueOnce([]);
      const res = await deleteResourceAclAction("missing", "csrf");
      expect(res).toHaveProperty("error", "ACL not found");
    });
  });

  describe("simulatePermissionAction", () => {
    it("returns simulation results", async () => {
      const res = await simulatePermissionAction({
        userId: "user-1",
        userRole: "admin",
        permission: "project:create",
      }, "csrf");
      expect(res).toHaveProperty("success", true);
      expect(res).toHaveProperty("result");
    });
  });
});
