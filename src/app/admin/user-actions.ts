"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { eq, inArray } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { requireCsrfToken } from "@/lib/csrf";

const VALID_ROLES: Role[] = ["admin", "manager", "member", "viewer"];

/**
 * Update a user's role (admin only)
 */
export async function updateUserRole(
  targetUserId: string,
  newRole: string,
  csrfToken: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireCsrfToken(csrfToken);
    const user = await requireAuth();

    if (!hasPermission(user.role as Role, "user:manage")) {
      return { error: "You don't have permission to manage users" };
    }

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
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { error: "You must be logged in" };
    }
    return { error: "Failed to update user role" };
  }
}

/**
 * Bulk update user roles (admin only)
 */
export async function bulkUpdateUserRole(
  targetUserIds: string[],
  newRole: string,
  csrfToken: string
): Promise<{ error?: string; success?: boolean; count?: number }> {
  try {
    await requireCsrfToken(csrfToken);
    const user = await requireAuth();

    if (!hasPermission(user.role as Role, "user:manage")) {
      return { error: "You don't have permission to manage users" };
    }

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
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { error: "You must be logged in" };
    }
    return { error: "Failed to update user roles" };
  }
}

/**
 * Bulk delete users (admin only)
 */
export async function bulkDeleteUsers(
  targetUserIds: string[],
  csrfToken: string
): Promise<{ error?: string; success?: boolean; count?: number }> {
  try {
    await requireCsrfToken(csrfToken);
    const user = await requireAuth();

    if (!hasPermission(user.role as Role, "user:manage")) {
      return { error: "You don't have permission to manage users" };
    }

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
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { error: "You must be logged in" };
    }
    return { error: "Failed to delete users" };
  }
}
