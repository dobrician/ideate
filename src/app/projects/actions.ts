"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { hasPermission, canManageResource } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { logAudit } from "@/lib/audit";
import { requireCsrfToken } from "@/lib/csrf";

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
  try {
    await requireCsrfToken(formData.get("csrfToken") as string);
    const user = await requireAuth();

    if (!hasPermission(user.role as Role, "project:create")) {
      return { error: "You don't have permission to create projects" };
    }

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

    await logAudit({
      userId: user.id,
      action: "create",
      entity: "project",
      entityId: projectId,
      details: JSON.stringify({ title }),
    });

    revalidatePath("/projects");
    redirect(`/projects/${projectId}`);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      redirect("/auth/login");
    }
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
      throw error;
    }
    return { error: "Failed to create project. Please try again." };
  }
}

/**
 * Update an existing project
 */
export async function updateProject(projectId: string, formData: FormData) {
  try {
    await requireCsrfToken(formData.get("csrfToken") as string);
    const user = await requireAuth();

    if (!hasPermission(user.role as Role, "project:update")) {
      return { error: "You don't have permission to update projects" };
    }

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

    await logAudit({
      userId: user.id,
      action: "update",
      entity: "project",
      entityId: projectId,
      details: JSON.stringify({ title }),
    });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/projects");

    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      redirect("/auth/login");
    }
    return { error: "Failed to update project. Please try again." };
  }
}

/**
 * Delete a project
 */
export async function deleteProject(projectId: string, csrfToken: string) {
  try {
    await requireCsrfToken(csrfToken);
    const user = await requireAuth();

    if (!hasPermission(user.role as Role, "project:delete")) {
      return { error: "You don't have permission to delete projects" };
    }

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
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      redirect("/auth/login");
    }
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
      throw error;
    }
    return { error: "Failed to delete project. Please try again." };
  }
}
