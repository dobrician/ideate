"use server";

import { withActionAuth } from "@/lib/action-wrapper";
import { db } from "@/db";
import { permissionRules, resourceAcls } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { ALL_PERMISSIONS, type Permission } from "@/lib/rbac";
import { randomUUID } from "crypto";

// ─── Permission Rule CRUD ───────────────────────────────────────────────

export interface CreateRuleInput {
  name: string;
  description?: string;
  ruleType: "time_expiry" | "schedule" | "deadline" | "condition";
  targetType: "user" | "role" | "all";
  targetId?: string;
  permission: string;
  effect: "grant" | "deny";
  startsAt?: number; // epoch ms
  expiresAt?: number; // epoch ms
  schedule?: string; // JSON
  condition?: string; // JSON
  entityType?: "project" | "proposal";
  entityId?: string;
}

export async function createPermissionRuleAction(input: CreateRuleInput, csrfToken: string) {
  return withActionAuth(csrfToken, { permission: "user:manage" }, async (user) => {
    if (!input.name?.trim()) return { error: "Rule name is required" };
    if (!ALL_PERMISSIONS.includes(input.permission as Permission)) {
      return { error: "Invalid permission" };
    }
    if (!["time_expiry", "schedule", "deadline", "condition"].includes(input.ruleType)) {
      return { error: "Invalid rule type" };
    }
    if (!["user", "role", "all"].includes(input.targetType)) {
      return { error: "Invalid target type" };
    }
    if (!["grant", "deny"].includes(input.effect)) {
      return { error: "Invalid effect" };
    }
    if (input.name.length > 255) return { error: "Name too long (max 255)" };

    // Validate JSON fields
    if (input.schedule) {
      try {
        const s = JSON.parse(input.schedule);
        if (!Array.isArray(s.days) || typeof s.startHour !== "number" || typeof s.endHour !== "number") {
          return { error: "Invalid schedule format: requires days, startHour, endHour" };
        }
      } catch { return { error: "Invalid schedule JSON" }; }
    }
    if (input.condition) {
      try {
        const c = JSON.parse(input.condition);
        if (!c.type || !c.operator || c.value === undefined) {
          return { error: "Invalid condition format: requires type, operator, value" };
        }
      } catch { return { error: "Invalid condition JSON" }; }
    }

    const id = randomUUID();
    await db.insert(permissionRules).values({
      id,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      ruleType: input.ruleType,
      targetType: input.targetType,
      targetId: input.targetId || null,
      permission: input.permission,
      effect: input.effect,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      schedule: input.schedule || null,
      condition: input.condition || null,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      active: true,
      createdBy: user.id,
    });

    await logAudit({
      userId: user.id,
      action: "permission_rule.create",
      entity: "permission_rule",
      entityId: id,
      details: JSON.stringify({ name: input.name, ruleType: input.ruleType, permission: input.permission, effect: input.effect }),
    });

    revalidatePath("/admin/permissions");
    return { success: true, id };
  });
}

export async function updatePermissionRuleAction(
  ruleId: string,
  updates: { active?: boolean; name?: string; expiresAt?: number | null },
  csrfToken: string,
) {
  return withActionAuth(csrfToken, { permission: "user:manage" }, async (user) => {
    if (!ruleId) return { error: "Rule ID required" };

    const existing = await db.select().from(permissionRules).where(eq(permissionRules.id, ruleId));
    if (!existing.length) return { error: "Rule not found" };

    const vals: Record<string, unknown> = {};
    if (updates.active !== undefined) vals.active = updates.active;
    if (updates.name !== undefined) vals.name = updates.name.trim();
    if (updates.expiresAt !== undefined) {
      vals.expiresAt = updates.expiresAt ? new Date(updates.expiresAt) : null;
    }

    await db.update(permissionRules).set(vals).where(eq(permissionRules.id, ruleId));

    await logAudit({
      userId: user.id,
      action: "permission_rule.update",
      entity: "permission_rule",
      entityId: ruleId,
      details: JSON.stringify(updates),
    });

    revalidatePath("/admin/permissions");
    return { success: true };
  });
}

export async function deletePermissionRuleAction(ruleId: string, csrfToken: string) {
  return withActionAuth(csrfToken, { permission: "user:manage" }, async (user) => {
    if (!ruleId) return { error: "Rule ID required" };

    const existing = await db.select().from(permissionRules).where(eq(permissionRules.id, ruleId));
    if (!existing.length) return { error: "Rule not found" };

    await db.delete(permissionRules).where(eq(permissionRules.id, ruleId));

    await logAudit({
      userId: user.id,
      action: "permission_rule.delete",
      entity: "permission_rule",
      entityId: ruleId,
      details: JSON.stringify({ name: existing[0].name }),
    });

    revalidatePath("/admin/permissions");
    return { success: true };
  });
}

// ─── Resource ACL CRUD ──────────────────────────────────────────────────

export interface CreateAclInput {
  entityType: "project" | "proposal";
  entityId: string;
  granteeType: "user" | "role";
  granteeId: string;
  permission: string;
  effect: "grant" | "deny";
  expiresAt?: number; // epoch ms
  reason?: string;
}

export async function createResourceAclAction(input: CreateAclInput, csrfToken: string) {
  return withActionAuth(csrfToken, { permission: "user:manage" }, async (user) => {
    if (!input.entityId?.trim()) return { error: "Entity ID is required" };
    if (!input.granteeId?.trim()) return { error: "Grantee ID is required" };
    if (!ALL_PERMISSIONS.includes(input.permission as Permission)) {
      return { error: "Invalid permission" };
    }

    const id = randomUUID();
    await db.insert(resourceAcls).values({
      id,
      entityType: input.entityType,
      entityId: input.entityId.trim(),
      granteeType: input.granteeType,
      granteeId: input.granteeId.trim(),
      permission: input.permission,
      effect: input.effect,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      grantedBy: user.id,
      reason: input.reason?.trim() || null,
    });

    await logAudit({
      userId: user.id,
      action: "acl.grant",
      entity: "resource_acl",
      entityId: id,
      details: JSON.stringify({
        entityType: input.entityType,
        entityId: input.entityId,
        granteeType: input.granteeType,
        granteeId: input.granteeId,
        permission: input.permission,
        effect: input.effect,
      }),
    });

    revalidatePath("/admin/permissions");
    return { success: true, id };
  });
}

export async function deleteResourceAclAction(aclId: string, csrfToken: string) {
  return withActionAuth(csrfToken, { permission: "user:manage" }, async (user) => {
    if (!aclId) return { error: "ACL ID required" };

    const existing = await db.select().from(resourceAcls).where(eq(resourceAcls.id, aclId));
    if (!existing.length) return { error: "ACL not found" };

    await db.delete(resourceAcls).where(eq(resourceAcls.id, aclId));

    await logAudit({
      userId: user.id,
      action: "acl.revoke",
      entity: "resource_acl",
      entityId: aclId,
      details: JSON.stringify({
        entityType: existing[0].entityType,
        entityId: existing[0].entityId,
        granteeId: existing[0].granteeId,
        permission: existing[0].permission,
      }),
    });

    revalidatePath("/admin/permissions");
    return { success: true };
  });
}

// ─── Simulation Action ──────────────────────────────────────────────────

export async function simulatePermissionAction(
  input: {
    userId: string;
    userRole: string;
    permission: string;
    entityType?: "project" | "proposal";
    entityId?: string;
  },
  csrfToken: string,
) {
  return withActionAuth(csrfToken, { permission: "user:manage" }, async () => {
    const { simulatePermission } = await import("@/lib/rbac/dynamic");
    const result = await simulatePermission({
      userId: input.userId,
      userRole: input.userRole,
      permission: input.permission as Permission,
      entityType: input.entityType,
      entityId: input.entityId,
    });
    return { success: true, result };
  });
}
