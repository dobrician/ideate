"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { Role } from "@/lib/rbac";
import { eq, inArray } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { withActionAuth } from "@/lib/action-wrapper";

const VALID_ROLES: Role[] = ["admin", "manager", "member", "viewer"];

/**
 * Update a user's role (admin only)
 */
export async function updateUserRole(
  targetUserId: string,
  newRole: string,
  csrfToken: string
): Promise<{ error?: string; success?: boolean }> {
  return withActionAuth(csrfToken, { permission: "user:manage" }, async (user) => {
    if (!VALID_ROLES.includes(newRole as Role)) {
      return { error: "Invalid role" };
    }

    if (targetUserId === user.id) {
      return { error: "You cannot change your own role" };
    }

    const target = await db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (target.length === 0) {
      return { error: "User not found" };
    }

    await db
      .update(users)
      .set({ role: newRole as Role, updatedAt: new Date() })
      .where(eq(users.id, targetUserId));

    await logAudit({
      userId: user.id,
      action: "update",
      entity: "user",
      entityId: targetUserId,
      details: JSON.stringify({
        oldRole: target[0].role,
        newRole,
      }),
    });

    revalidatePath("/admin");
    return { success: true };
  });
}

/**
 * Bulk update user roles (admin only)
 */
export async function bulkUpdateUserRole(
  targetUserIds: string[],
  newRole: string,
  csrfToken: string
): Promise<{ error?: string; success?: boolean; count?: number }> {
  return withActionAuth(csrfToken, { permission: "user:manage" }, async (user) => {
    if (!VALID_ROLES.includes(newRole as Role)) {
      return { error: "Invalid role" };
    }

    if (targetUserIds.length === 0) {
      return { error: "No users selected" };
    }

    // Filter out self
    const ids = targetUserIds.filter((id) => id !== user.id);
    if (ids.length === 0) {
      return { error: "You cannot change your own role" };
    }

    await db
      .update(users)
      .set({ role: newRole as Role, updatedAt: new Date() })
      .where(inArray(users.id, ids));

    await logAudit({
      userId: user.id,
      action: "bulk_update",
      entity: "user",
      details: JSON.stringify({ userIds: ids, newRole }),
    });

    revalidatePath("/admin");
    return { success: true, count: ids.length };
  });
}

/**
 * Bulk delete users (admin only)
 */
export async function bulkDeleteUsers(
  targetUserIds: string[],
  csrfToken: string
): Promise<{ error?: string; success?: boolean; count?: number }> {
  return withActionAuth(csrfToken, { permission: "user:manage" }, async (user) => {
    if (targetUserIds.length === 0) {
      return { error: "No users selected" };
    }

    const ids = targetUserIds.filter((id) => id !== user.id);
    if (ids.length === 0) {
      return { error: "You cannot delete yourself" };
    }

    await db.delete(users).where(inArray(users.id, ids));

    await logAudit({
      userId: user.id,
      action: "bulk_delete",
      entity: "user",
      details: JSON.stringify({ userIds: ids }),
    });

    revalidatePath("/admin");
    return { success: true, count: ids.length };
  });
}
