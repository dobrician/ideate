"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users, projects, tags, projectTags } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { eq, inArray, and } from "drizzle-orm";
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

/**
 * Bulk archive projects (admin only)
 */
export async function bulkArchiveProjects(
  projectIds: string[],
  csrfToken: string
): Promise<{ error?: string; success?: boolean; count?: number }> {
  try {
    await requireCsrfToken(csrfToken);
    const user = await requireAuth();

    if (!hasPermission(user.role as Role, "project:manage_all")) {
      return { error: "Only admins can bulk archive projects" };
    }

    if (projectIds.length === 0) {
      return { error: "No projects selected" };
    }

    await db
      .update(projects)
      .set({ status: "archived", updatedAt: new Date() })
      .where(inArray(projects.id, projectIds));

    await logAudit({
      userId: user.id,
      action: "bulk_archive",
      entity: "project",
      details: JSON.stringify({ projectIds }),
    });

    revalidatePath("/admin");
    revalidatePath("/projects");
    return { success: true, count: projectIds.length };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { error: "You must be logged in" };
    }
    return { error: "Failed to archive projects" };
  }
}

/**
 * Bulk delete projects (admin only)
 */
export async function bulkDeleteProjects(
  projectIds: string[],
  csrfToken: string
): Promise<{ error?: string; success?: boolean; count?: number }> {
  try {
    await requireCsrfToken(csrfToken);
    const user = await requireAuth();

    if (!hasPermission(user.role as Role, "project:manage_all")) {
      return { error: "Only admins can bulk delete projects" };
    }

    if (projectIds.length === 0) {
      return { error: "No projects selected" };
    }

    await db.delete(projects).where(inArray(projects.id, projectIds));

    await logAudit({
      userId: user.id,
      action: "bulk_delete",
      entity: "project",
      details: JSON.stringify({ projectIds }),
    });

    revalidatePath("/admin");
    revalidatePath("/projects");
    return { success: true, count: projectIds.length };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { error: "You must be logged in" };
    }
    return { error: "Failed to delete projects" };
  }
}

/**
 * Create a new tag (admin only)
 */
export async function createTag(
  name: string,
  csrfToken: string
): Promise<{ error?: string; success?: boolean; id?: string }> {
  try {
    await requireCsrfToken(csrfToken);
    const user = await requireAuth();

    if (!hasPermission(user.role as Role, "project:manage_all")) {
      return { error: "Only admins can manage tags" };
    }

    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 50) {
      return { error: "Tag name must be 1-50 characters" };
    }

    const existing = await db
      .select()
      .from(tags)
      .where(eq(tags.name, trimmed))
      .limit(1);

    if (existing.length > 0) {
      return { error: "Tag already exists" };
    }

    const [tag] = await db
      .insert(tags)
      .values({ name: trimmed })
      .returning({ id: tags.id });

    await logAudit({
      userId: user.id,
      action: "create",
      entity: "tag",
      entityId: tag.id,
      details: JSON.stringify({ name: trimmed }),
    });

    revalidatePath("/admin");
    revalidatePath("/projects");
    return { success: true, id: tag.id };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { error: "You must be logged in" };
    }
    return { error: "Failed to create tag" };
  }
}

/**
 * Delete a tag (admin only)
 */
export async function deleteTag(
  tagId: string,
  csrfToken: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireCsrfToken(csrfToken);
    const user = await requireAuth();

    if (!hasPermission(user.role as Role, "project:manage_all")) {
      return { error: "Only admins can manage tags" };
    }

    await db.delete(tags).where(eq(tags.id, tagId));

    await logAudit({
      userId: user.id,
      action: "delete",
      entity: "tag",
      entityId: tagId,
    });

    revalidatePath("/admin");
    revalidatePath("/projects");
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { error: "You must be logged in" };
    }
    return { error: "Failed to delete tag" };
  }
}

/**
 * Add a tag to a project (admin/manager or project owner)
 */
export async function addProjectTag(
  projectId: string,
  tagId: string,
  csrfToken: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireCsrfToken(csrfToken);
    const user = await requireAuth();

    if (!hasPermission(user.role as Role, "project:manage_all")) {
      return { error: "Only admins can manage project tags" };
    }

    await db
      .insert(projectTags)
      .values({ projectId, tagId })
      .onConflictDoNothing();

    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { error: "You must be logged in" };
    }
    return { error: "Failed to add tag to project" };
  }
}

/**
 * Remove a tag from a project
 */
export async function removeProjectTag(
  projectId: string,
  tagId: string,
  csrfToken: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireCsrfToken(csrfToken);
    const user = await requireAuth();

    if (!hasPermission(user.role as Role, "project:manage_all")) {
      return { error: "Only admins can manage project tags" };
    }

    await db
      .delete(projectTags)
      .where(
        and(eq(projectTags.projectId, projectId), eq(projectTags.tagId, tagId))
      );

    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { error: "You must be logged in" };
    }
    return { error: "Failed to remove tag from project" };
  }
}
