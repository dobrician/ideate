/**
 * Workflow Engine — manages proposal lifecycle through configurable stages.
 * Supports linear workflows with role-based stage transitions.
 */

import { db } from "@/db";
import {
  workflows, workflowStages, proposalWorkflowState,
  approvalRecords, proposals, projects,
} from "@/db/schema";
import { eq, and, sql, asc } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { randomUUID } from "crypto";

const log = logger.child({ module: "workflow" });

export interface WorkflowDefinition {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  stages: StageDefinition[];
  isDefault: boolean;
}

export interface StageDefinition {
  id: string;
  name: string;
  description: string | null;
  order: number;
  allowedRoles: string[];
  autoAdvance: boolean;
  autoAdvanceAfter: number | null;
}

export interface ProposalState {
  proposalId: string;
  workflowId: string;
  currentStageId: string;
  currentStageName: string;
  status: "active" | "completed" | "rejected";
  stageIndex: number;
  totalStages: number;
}

export interface TransitionResult {
  success: boolean;
  newStageId?: string;
  newStageName?: string;
  error?: string;
}

// ─── Default Workflow Templates ─────────────────────────────────────────

const DEFAULT_STAGES = [
  { name: "Draft", description: "Initial proposal submission", allowedRoles: ["admin", "manager", "member"] },
  { name: "Review", description: "Under review by managers", allowedRoles: ["admin", "manager"] },
  { name: "Voting", description: "Open for community voting", allowedRoles: ["admin", "manager"] },
  { name: "Approved", description: "Proposal approved", allowedRoles: ["admin"] },
];

/**
 * Create a workflow for a project with default or custom stages.
 */
export async function createWorkflow(
  projectId: string,
  name: string,
  description?: string,
  customStages?: Array<{ name: string; description?: string; allowedRoles?: string[] }>
): Promise<WorkflowDefinition | null> {
  try {
    const workflowId = randomUUID();
    const stageTemplates = customStages && customStages.length > 0
      ? customStages
      : DEFAULT_STAGES;

    await db.insert(workflows).values({
      id: workflowId,
      projectId,
      name,
      description: description ?? null,
      stages: "[]",
      isDefault: !customStages || customStages.length === 0,
    });

    const stageIds: string[] = [];
    for (let i = 0; i < stageTemplates.length; i++) {
      const stageId = randomUUID();
      stageIds.push(stageId);
      await db.insert(workflowStages).values({
        id: stageId,
        workflowId,
        name: stageTemplates[i].name,
        description: stageTemplates[i].description ?? null,
        stageOrder: i,
        allowedRoles: JSON.stringify(stageTemplates[i].allowedRoles ?? ["admin", "manager"]),
      });
    }

    // Update workflow with stage order
    await db.update(workflows)
      .set({ stages: JSON.stringify(stageIds) })
      .where(eq(workflows.id, workflowId));

    log.info({ workflowId, projectId, stageCount: stageIds.length }, "Workflow created");

    return getWorkflow(workflowId);
  } catch (err) {
    log.error({ err, projectId }, "Failed to create workflow");
    return null;
  }
}

/**
 * Get a workflow with its stages.
 */
export async function getWorkflow(workflowId: string): Promise<WorkflowDefinition | null> {
  try {
    const [wf] = await db
      .select()
      .from(workflows)
      .where(eq(workflows.id, workflowId))
      .limit(1);

    if (!wf) return null;

    const stages = await db
      .select()
      .from(workflowStages)
      .where(eq(workflowStages.workflowId, workflowId))
      .orderBy(asc(workflowStages.stageOrder));

    return {
      id: wf.id,
      projectId: wf.projectId,
      name: wf.name,
      description: wf.description,
      isDefault: Boolean(wf.isDefault),
      stages: stages.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        order: s.stageOrder,
        allowedRoles: parseJson(s.allowedRoles),
        autoAdvance: Boolean(s.autoAdvance),
        autoAdvanceAfter: s.autoAdvanceAfter,
      })),
    };
  } catch (err) {
    log.error({ err, workflowId }, "Failed to get workflow");
    return null;
  }
}

/**
 * Get the workflow for a project (or create default).
 */
export async function getProjectWorkflow(
  projectId: string
): Promise<WorkflowDefinition | null> {
  try {
    const [existing] = await db
      .select()
      .from(workflows)
      .where(eq(workflows.projectId, projectId))
      .limit(1);

    if (existing) return getWorkflow(existing.id);
    return null;
  } catch (err) {
    log.error({ err, projectId }, "Failed to get project workflow");
    return null;
  }
}

/**
 * Assign a proposal to a workflow, starting at the first stage.
 */
export async function assignProposalToWorkflow(
  proposalId: string,
  workflowId: string
): Promise<ProposalState | null> {
  try {
    const wf = await getWorkflow(workflowId);
    if (!wf || wf.stages.length === 0) return null;

    const firstStage = wf.stages[0];

    await db.insert(proposalWorkflowState).values({
      proposalId,
      workflowId,
      currentStageId: firstStage.id,
      status: "active",
    }).onConflictDoUpdate({
      target: proposalWorkflowState.proposalId,
      set: {
        workflowId,
        currentStageId: firstStage.id,
        status: "active",
        enteredAt: new Date(),
        updatedAt: new Date(),
      },
    });

    log.info({ proposalId, workflowId, stage: firstStage.name }, "Proposal assigned to workflow");

    return {
      proposalId,
      workflowId,
      currentStageId: firstStage.id,
      currentStageName: firstStage.name,
      status: "active",
      stageIndex: 0,
      totalStages: wf.stages.length,
    };
  } catch (err) {
    log.error({ err, proposalId, workflowId }, "Failed to assign proposal to workflow");
    return null;
  }
}

/**
 * Get the current workflow state of a proposal.
 */
export async function getProposalState(
  proposalId: string
): Promise<ProposalState | null> {
  try {
    const [state] = await db
      .select()
      .from(proposalWorkflowState)
      .where(eq(proposalWorkflowState.proposalId, proposalId))
      .limit(1);

    if (!state) return null;

    const wf = await getWorkflow(state.workflowId);
    if (!wf) return null;

    const currentStage = wf.stages.find((s) => s.id === state.currentStageId);
    const stageIndex = wf.stages.findIndex((s) => s.id === state.currentStageId);

    return {
      proposalId,
      workflowId: state.workflowId,
      currentStageId: state.currentStageId,
      currentStageName: currentStage?.name ?? "Unknown",
      status: state.status as "active" | "completed" | "rejected",
      stageIndex: stageIndex >= 0 ? stageIndex : 0,
      totalStages: wf.stages.length,
    };
  } catch (err) {
    log.error({ err, proposalId }, "Failed to get proposal state");
    return null;
  }
}

/**
 * Advance a proposal to the next workflow stage.
 */
export async function advanceProposal(
  proposalId: string,
  userId: string,
  userRole: string,
  comment?: string
): Promise<TransitionResult> {
  try {
    const state = await getProposalState(proposalId);
    if (!state) return { success: false, error: "No workflow state found" };
    if (state.status !== "active") return { success: false, error: "Proposal is not active" };

    const wf = await getWorkflow(state.workflowId);
    if (!wf) return { success: false, error: "Workflow not found" };

    const currentStage = wf.stages.find((s) => s.id === state.currentStageId);
    if (!currentStage) return { success: false, error: "Current stage not found" };

    // Check role permission for this stage
    if (!currentStage.allowedRoles.includes(userRole)) {
      return { success: false, error: "Insufficient role for this stage transition" };
    }

    // Record approval
    await db.insert(approvalRecords).values({
      id: randomUUID(),
      proposalId,
      stageId: state.currentStageId,
      userId,
      action: "approve",
      comment: comment ?? null,
    });

    // Determine next stage
    const nextIndex = state.stageIndex + 1;
    if (nextIndex >= wf.stages.length) {
      // Final stage → mark as completed
      await db.update(proposalWorkflowState)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(proposalWorkflowState.proposalId, proposalId));

      log.info({ proposalId }, "Proposal workflow completed");
      return { success: true, newStageName: "Completed" };
    }

    const nextStage = wf.stages[nextIndex];
    await db.update(proposalWorkflowState)
      .set({
        currentStageId: nextStage.id,
        enteredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(proposalWorkflowState.proposalId, proposalId));

    log.info({ proposalId, newStage: nextStage.name }, "Proposal advanced to next stage");

    return {
      success: true,
      newStageId: nextStage.id,
      newStageName: nextStage.name,
    };
  } catch (err) {
    log.error({ err, proposalId }, "Failed to advance proposal");
    return { success: false, error: "Internal error during transition" };
  }
}

/**
 * Reject a proposal in the current stage.
 */
export async function rejectProposal(
  proposalId: string,
  userId: string,
  userRole: string,
  comment?: string
): Promise<TransitionResult> {
  try {
    const state = await getProposalState(proposalId);
    if (!state) return { success: false, error: "No workflow state found" };
    if (state.status !== "active") return { success: false, error: "Proposal is not active" };

    const wf = await getWorkflow(state.workflowId);
    if (!wf) return { success: false, error: "Workflow not found" };

    const currentStage = wf.stages.find((s) => s.id === state.currentStageId);
    if (!currentStage) return { success: false, error: "Current stage not found" };

    if (!currentStage.allowedRoles.includes(userRole)) {
      return { success: false, error: "Insufficient role for rejection" };
    }

    await db.insert(approvalRecords).values({
      id: randomUUID(),
      proposalId,
      stageId: state.currentStageId,
      userId,
      action: "reject",
      comment: comment ?? null,
    });

    await db.update(proposalWorkflowState)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(proposalWorkflowState.proposalId, proposalId));

    log.info({ proposalId, stage: currentStage.name }, "Proposal rejected");

    return { success: true, newStageName: "Rejected" };
  } catch (err) {
    log.error({ err, proposalId }, "Failed to reject proposal");
    return { success: false, error: "Internal error during rejection" };
  }
}

/**
 * Get approval history for a proposal.
 */
export async function getApprovalHistory(
  proposalId: string
): Promise<Array<{
  id: string;
  stageId: string;
  userId: string;
  action: string;
  comment: string | null;
  createdAt: Date | null;
}>> {
  try {
    return db
      .select()
      .from(approvalRecords)
      .where(eq(approvalRecords.proposalId, proposalId))
      .orderBy(asc(approvalRecords.createdAt));
  } catch (err) {
    log.error({ err, proposalId }, "Failed to get approval history");
    return [];
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────

function parseJson(str: string): string[] {
  try {
    return JSON.parse(str) as string[];
  } catch {
    return [];
  }
}
