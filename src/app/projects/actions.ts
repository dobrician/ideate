"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { projects, projectTags } from "@/db/schema";
import { canManageResource } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { logAudit } from "@/lib/audit";
import { fireWebhookEvent } from "@/lib/webhooks";
import { emitProjectEvent } from "@/lib/project-events";
import { enqueueEmbedding } from "@/lib/embeddings/jobs";
import { withActionAuth } from "@/lib/action-wrapper";

/**
 * Project validation schema
 */
const projectSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title too long"),
  description: z.string().max(5000, "Description too long").optional(),
  deadline: z.string().refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime()) && parsed > new Date();
  }, "Deadline must be a valid future date"),
  status: z.enum(["active", "archived", "draft"]).default("active"),
});

/**
 * Create a new project
 */
export async function createProject(formData: FormData) {
  return withActionAuth(formData.get("csrfToken") as string, {
    permission: "project:create",
    rateLimitKey: "project:create",
    rateLimitMax: 10,
  }, async (user) => {
    const data = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      deadline: formData.get("deadline") as string,
      status: (formData.get("status") as string) || "active",
    };

    const result = projectSchema.safeParse(data);

    if (!result.success) {
      return { error: result.error.issues[0].message };
    }

    const { title, description, deadline, status } = result.data;

    const projectId = randomUUID();
    await db.insert(projects).values({
      id: projectId,
      title,
      description: description || null,
      deadline: new Date(deadline),
      status,
      userId: user.id,
    });

    // Save project tags
    const tagIds = formData.getAll("tagIds") as string[];
    if (tagIds.length > 0) {
      await db.insert(projectTags).values(
        tagIds.map((tagId) => ({ projectId, tagId }))
      );
    }

    await logAudit({
      userId: user.id,
      action: "create",
      entity: "project",
      entityId: projectId,
      details: JSON.stringify({ title }),
    });

    fireWebhookEvent("project.created", { projectId, title, userId: user.id }).catch((err) => logger.warn({ err }, "Webhook delivery failed"));
    enqueueEmbedding("project", projectId).catch((err) => logger.warn({ err }, "Embedding enqueue failed"));

    revalidatePath("/projects");
    redirect(`/projects/${projectId}`);
  });
}

/**
 * Update an existing project
 */
export async function updateProject(projectId: string, formData: FormData) {
  return withActionAuth(formData.get("csrfToken") as string, {
    permission: "project:update",
    rateLimitKey: "project:update",
    rateLimitMax: 20,
  }, async (user) => {
    const data = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      deadline: formData.get("deadline") as string,
      status: (formData.get("status") as string) || "active",
    };

    const result = projectSchema.safeParse(data);

    if (!result.success) {
      return { error: result.error.issues[0].message };
    }

    const { title, description, deadline, status } = result.data;

    const existingProject = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (existingProject.length === 0) {
      return { error: "Project not found" };
    }

    if (!canManageResource(user.role as Role, existingProject[0].userId, user.id)) {
      return { error: "You don't have permission to update this project" };
    }

    await db
      .update(projects)
      .set({
        title,
        description: description || null,
        deadline: new Date(deadline),
        status,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    // Sync project tags: delete all then re-insert
    const tagIds = formData.getAll("tagIds") as string[];
    await db.delete(projectTags).where(eq(projectTags.projectId, projectId));
    if (tagIds.length > 0) {
      await db.insert(projectTags).values(
        tagIds.map((tagId) => ({ projectId, tagId }))
      );
    }

    await logAudit({
      userId: user.id,
      action: "update",
      entity: "project",
      entityId: projectId,
      details: JSON.stringify({ title }),
    });

    if (status === "archived" && existingProject[0].status !== "archived") {
      fireWebhookEvent("project.archived", { projectId, title, userId: user.id }).catch((err) => logger.warn({ err }, "Webhook delivery failed"));
    }

    if (status !== existingProject[0].status) {
      emitProjectEvent({
        projectId,
        action: "status_changed",
        entityId: projectId,
        summary: `Status changed to ${status}`,
        userId: user.id,
        userName: user.email,
      });
    }

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/projects");

    return { success: true };
  });
}

/**
 * Unarchive a project (admin only) — sets status back to active
 */
export async function unarchiveProject(projectId: string, csrfToken: string) {
  return withActionAuth(csrfToken, {
    permission: "project:manage_all",
    rateLimitKey: "project:unarchive",
    rateLimitMax: 10,
  }, async (user) => {
    const existingProject = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (existingProject.length === 0) {
      return { error: "Project not found" };
    }

    if (existingProject[0].status !== "archived") {
      return { error: "Project is not archived" };
    }

    await db
      .update(projects)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    await logAudit({
      userId: user.id,
      action: "update",
      entity: "project",
      entityId: projectId,
      details: JSON.stringify({ action: "unarchive" }),
    });

    emitProjectEvent({
      projectId,
      action: "status_changed",
      entityId: projectId,
      summary: "Status changed to active",
      userId: user.id,
      userName: user.email,
    });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/projects");

    return { success: true };
  });
}

/**
 * Delete a project
 */
export async function deleteProject(projectId: string, csrfToken: string) {
  return withActionAuth(csrfToken, {
    permission: "project:delete",
    rateLimitKey: "project:delete",
    rateLimitMax: 10,
  }, async (user) => {
    const existingProject = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (existingProject.length === 0) {
      return { error: "Project not found" };
    }

    if (!canManageResource(user.role as Role, existingProject[0].userId, user.id)) {
      return { error: "You don't have permission to delete this project" };
    }

    await db.delete(projects).where(eq(projects.id, projectId));

    await logAudit({
      userId: user.id,
      action: "delete",
      entity: "project",
      entityId: projectId,
    });

    revalidatePath("/projects");
    redirect("/projects");
  });
}
