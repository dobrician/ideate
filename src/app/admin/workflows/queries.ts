import { db } from "@/db";
import { workflows, workflowStages, projects } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function getWorkflowPageData() {
  const allWorkflows = await db.select().from(workflows);
  const allStages = await db.select().from(workflowStages).orderBy(asc(workflowStages.stageOrder));
  const allProjects = await db
    .select({ id: projects.id, title: projects.title })
    .from(projects)
    .orderBy(asc(projects.title));

  const parsed = allWorkflows.map((wf) => ({
    id: wf.id,
    projectId: wf.projectId,
    name: wf.name,
    isDefault: Boolean(wf.isDefault),
    stages: allStages
      .filter((s) => s.workflowId === wf.id)
      .map((s) => ({
        id: s.id,
        name: s.name,
        order: s.stageOrder,
        allowedRoles: parseJson(s.allowedRoles),
      })),
  }));

  return {
    workflows: parsed,
    projects: allProjects,
  };
}

function parseJson(str: string): string[] {
  try {
    return JSON.parse(str) as string[];
  } catch {
    return [];
  }
}
