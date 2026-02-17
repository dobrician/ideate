import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function isDeadlinePassed(projectId: string): Promise<boolean> {
  const project = await db
    .select({ deadline: projects.deadline })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project[0]?.deadline) return false;
  return new Date(project[0].deadline).getTime() < Date.now();
}

export async function isProjectArchived(projectId: string): Promise<boolean> {
  const project = await db
    .select({ status: projects.status })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  return project[0]?.status === "archived";
}
