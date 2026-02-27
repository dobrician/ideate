"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { workflows, workflowStages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { withActionAuth } from "@/lib/action-wrapper";
import {
  createWorkflow as engineCreate,
  getProjectWorkflow,
  assignProposalToWorkflow,
  advanceProposal as engineAdvance,
  rejectProposal as engineReject,
} from "@/lib/workflow/engine";

interface StageInput {
  name: string;
  description?: string;
  allowedRoles?: string[];
}

export async function createWorkflowAction(
  projectId: string,
  name: string,
  stages: StageInput[],
  csrfToken: string
): Promise<{ error?: string; success?: boolean }> {
  return withActionAuth(csrfToken, { permission: "project:manage_all" }, async (user) => {
    if (!name.trim()) return { error: "Workflow name is required" };
    if (stages.length === 0) return { error: "At least one stage is required" };

    const existing = await getProjectWorkflow(projectId);
    if (existing) return { error: "Project already has a workflow" };

    const wf = await engineCreate(projectId, name.trim(), undefined, stages);
    if (!wf) return { error: "Failed to create workflow" };

    await logAudit({
      userId: user.id,
      action: "workflow.create",
      entity: "workflow",
      entityId: wf.id,
      details: JSON.stringify({ projectId, name, stageCount: stages.length }),
    });

    revalidatePath("/admin/workflows");
    return { success: true };
  });
}

export async function deleteWorkflowAction(
  workflowId: string,
  csrfToken: string
): Promise<{ error?: string; success?: boolean }> {
  return withActionAuth(csrfToken, { permission: "project:manage_all" }, async (user) => {
    await db.delete(workflowStages).where(eq(workflowStages.workflowId, workflowId));
    await db.delete(workflows).where(eq(workflows.id, workflowId));

    await logAudit({
      userId: user.id,
      action: "workflow.delete",
      entity: "workflow",
      entityId: workflowId,
    });

    revalidatePath("/admin/workflows");
    return { success: true };
  });
}

export async function assignWorkflowAction(
  proposalId: string,
  workflowId: string,
  csrfToken: string
): Promise<{ error?: string; success?: boolean }> {
  return withActionAuth(csrfToken, { permission: "project:manage_all" }, async (user) => {
    const result = await assignProposalToWorkflow(proposalId, workflowId);
    if (!result) return { error: "Failed to assign workflow" };

    await logAudit({
      userId: user.id,
      action: "workflow.assign",
      entity: "proposal",
      entityId: proposalId,
      details: JSON.stringify({ workflowId, stage: result.currentStageName }),
    });

    revalidatePath("/");
    return { success: true };
  });
}

export async function advanceProposalAction(
  proposalId: string,
  comment: string | undefined,
  csrfToken: string
): Promise<{ error?: string; success?: boolean; stageName?: string }> {
  return withActionAuth(csrfToken, { permission: "proposal:manage" }, async (user) => {
    const result = await engineAdvance(proposalId, user.id, user.role, comment);
    if (!result.success) return { error: result.error };

    await logAudit({
      userId: user.id,
      action: "workflow.advance",
      entity: "proposal",
      entityId: proposalId,
      details: JSON.stringify({ newStage: result.newStageName }),
    });

    revalidatePath("/");
    return { success: true, stageName: result.newStageName };
  });
}

export async function rejectProposalAction(
  proposalId: string,
  comment: string | undefined,
  csrfToken: string
): Promise<{ error?: string; success?: boolean }> {
  return withActionAuth(csrfToken, { permission: "proposal:manage" }, async (user) => {
    const result = await engineReject(proposalId, user.id, user.role, comment);
    if (!result.success) return { error: result.error };

    await logAudit({
      userId: user.id,
      action: "workflow.reject",
      entity: "proposal",
      entityId: proposalId,
      details: JSON.stringify({ comment }),
    });

    revalidatePath("/");
    return { success: true };
  });
}
