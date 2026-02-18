"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { projects, tags, projectTags } from "@/db/schema";
import type { Role } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { eq, inArray, and } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { fireWebhookEvent } from "@/lib/webhooks";
import { withActionAuth } from "@/lib/action-wrapper";

/**
 * Bulk archive projects (admin only)
 */
export async function bulkArchiveProjects(
  projectIds: string[],
  csrfToken: string
): Promise<{ error?: string; success?: boolean; count?: number }> {
  return withActionAuth(csrfToken, { permission: "project:manage_all" }, async (user) => {
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

    for (const pid of projectIds) {
      fireWebhookEvent("project.archived", { projectId: pid, userId: user.id }).catch((err) => logger.warn({ err }, "Webhook delivery failed"));
    }

    revalidatePath("/admin");
    revalidatePath("/projects");
    return { success: true, count: projectIds.length };
  });
}

/**
 * Bulk delete projects (admin only)
 */
export async function bulkDeleteProjects(
  projectIds: string[],
  csrfToken: string
): Promise<{ error?: string; success?: boolean; count?: number }> {
  return withActionAuth(csrfToken, { permission: "project:manage_all" }, async (user) => {
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
  });
}

/**
 * Create a new tag (admin only)
 */
export async function createTag(
  name: string,
  csrfToken: string
): Promise<{ error?: string; success?: boolean; id?: string }> {
  return withActionAuth(csrfToken, { permission: "project:manage_all" }, async (user) => {
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
  });
}

/**
 * Delete a tag (admin only)
 */
export async function deleteTag(
  tagId: string,
  csrfToken: string
): Promise<{ error?: string; success?: boolean }> {
  return withActionAuth(csrfToken, { permission: "project:manage_all" }, async (user) => {
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
  });
}

/**
 * Add a tag to a project (admin/manager or project owner)
 */
export async function addProjectTag(
  projectId: string,
  tagId: string,
  csrfToken: string
): Promise<{ error?: string; success?: boolean }> {
  return withActionAuth(csrfToken, { permission: "project:manage_all" }, async () => {
    await db
      .insert(projectTags)
      .values({ projectId, tagId })
      .onConflictDoNothing();

    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  });
}

/**
 * Remove a tag from a project
 */
export async function removeProjectTag(
  projectId: string,
  tagId: string,
  csrfToken: string
): Promise<{ error?: string; success?: boolean }> {
  return withActionAuth(csrfToken, { permission: "project:manage_all" }, async () => {
    await db
      .delete(projectTags)
      .where(
        and(eq(projectTags.projectId, projectId), eq(projectTags.tagId, tagId))
      );

    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  });
}
