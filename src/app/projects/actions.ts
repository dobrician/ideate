"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { requireAuth, getCsrfToken } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

/**
 * Project validation schema
 */
const projectSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200, "Title too long"),
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
    // Require authentication
    const user = await requireAuth();

    // Parse and validate form data
    const data = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      deadline: formData.get("deadline") as string,
      status: (formData.get("status") as string) || "active",
    };

    const result = projectSchema.safeParse(data);

    if (!result.success) {
      return {
        error: result.error.errors[0].message,
      };
    }

    const { title, description, deadline, status } = result.data;

    // Create project
    const projectId = randomUUID();
    await db.insert(projects).values({
      id: projectId,
      title,
      description: description || null,
      deadline: new Date(deadline),
      status,
      userId: user.id,
    });

    revalidatePath("/projects");
    redirect(`/projects/${projectId}`);
  } catch (error) {
    console.error("Create project error:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      redirect("/auth/login");
    }

    // Don't catch redirect errors
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
      throw error;
    }

    return {
      error: "Failed to create project. Please try again.",
    };
  }
}

/**
 * Update an existing project
 */
export async function updateProject(projectId: string, formData: FormData) {
  try {
    // Require authentication
    const user = await requireAuth();

    // Parse and validate form data
    const data = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      deadline: formData.get("deadline") as string,
      status: (formData.get("status") as string) || "active",
    };

    const result = projectSchema.safeParse(data);

    if (!result.success) {
      return {
        error: result.error.errors[0].message,
      };
    }

    const { title, description, deadline, status } = result.data;

    // Verify project exists and user owns it
    const existingProject = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (existingProject.length === 0) {
      return {
        error: "Project not found",
      };
    }

    // Check ownership (only owner can update)
    if (existingProject[0].userId !== user.id && user.role !== "admin") {
      return {
        error: "You don't have permission to update this project",
      };
    }

    // Update project
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

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/projects");

    return {
      success: true,
    };
  } catch (error) {
    console.error("Update project error:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      redirect("/auth/login");
    }

    return {
      error: "Failed to update project. Please try again.",
    };
  }
}

/**
 * Delete a project
 */
export async function deleteProject(projectId: string) {
  try {
    // Require authentication
    const user = await requireAuth();

    // Verify project exists and user owns it
    const existingProject = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (existingProject.length === 0) {
      return {
        error: "Project not found",
      };
    }

    // Check ownership (only owner or admin can delete)
    if (existingProject[0].userId !== user.id && user.role !== "admin") {
      return {
        error: "You don't have permission to delete this project",
      };
    }

    // Delete project (cascading deletes will handle proposals, votes, comments)
    await db.delete(projects).where(eq(projects.id, projectId));

    revalidatePath("/projects");
    redirect("/projects");
  } catch (error) {
    console.error("Delete project error:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      redirect("/auth/login");
    }

    // Don't catch redirect errors
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
      throw error;
    }

    return {
      error: "Failed to delete project. Please try again.",
    };
  }
}
