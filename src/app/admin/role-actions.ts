"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { customRoles } from "@/db/schema";
import { invalidateRoleCache, ALL_PERMISSIONS, BUILT_IN_ROLES } from "@/lib/rbac";
import type { Role, Permission } from "@/lib/rbac";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { withActionAuth } from "@/lib/action-wrapper";

type Result = { error?: string; success?: boolean };

export async function createCustomRole(
  name: string,
  description: string,
  permissions: string[],
  csrfToken: string
): Promise<Result> {
  return withActionAuth(csrfToken, { permission: "user:manage" }, async (user) => {
    const trimmed = name.trim().toLowerCase();
    if (!trimmed || trimmed.length < 2) return { error: "Role name must be at least 2 characters" };
    if (BUILT_IN_ROLES.includes(trimmed as Role)) {
      return { error: "Cannot override built-in roles" };
    }

    const valid = permissions.filter((p): p is Permission =>
      ALL_PERMISSIONS.includes(p as Permission)
    );

    const existing = await db.select().from(customRoles).where(eq(customRoles.name, trimmed)).limit(1);
    if (existing.length > 0) return { error: "A role with this name already exists" };

    const [role] = await db.insert(customRoles).values({
      name: trimmed,
      description: description.trim() || null,
      permissions: JSON.stringify(valid),
    }).returning();

    invalidateRoleCache();
    await logAudit({
      userId: user.id, action: "create", entity: "custom_role",
      entityId: role.id, details: JSON.stringify({ name: trimmed, permissions: valid }),
    });
    revalidatePath("/admin");
    return { success: true };
  });
}

export async function updateCustomRole(
  roleId: string,
  permissions: string[],
  description: string,
  csrfToken: string
): Promise<Result> {
  return withActionAuth(csrfToken, { permission: "user:manage" }, async (user) => {
    const valid = permissions.filter((p): p is Permission =>
      ALL_PERMISSIONS.includes(p as Permission)
    );

    await db.update(customRoles)
      .set({ permissions: JSON.stringify(valid), description: description.trim() || null })
      .where(eq(customRoles.id, roleId));

    invalidateRoleCache();
    await logAudit({
      userId: user.id, action: "update", entity: "custom_role",
      entityId: roleId, details: JSON.stringify({ permissions: valid }),
    });
    revalidatePath("/admin");
    return { success: true };
  });
}

export async function deleteCustomRole(
  roleId: string,
  csrfToken: string
): Promise<Result> {
  return withActionAuth(csrfToken, { permission: "user:manage" }, async (user) => {
    const role = await db.select().from(customRoles).where(eq(customRoles.id, roleId)).limit(1);
    if (role.length === 0) return { error: "Role not found" };
    if (role[0].isSystem) return { error: "Cannot delete system roles" };

    await db.delete(customRoles).where(eq(customRoles.id, roleId));
    invalidateRoleCache();

    await logAudit({
      userId: user.id, action: "delete", entity: "custom_role",
      entityId: roleId, details: JSON.stringify({ name: role[0].name }),
    });
    revalidatePath("/admin");
    return { success: true };
  });
}
