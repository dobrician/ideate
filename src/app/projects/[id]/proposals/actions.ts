"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { projects, proposals, votes } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { hasPermission, canManageResource } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { buildProposalSummary } from "@/lib/ai";
import { emitVoteChange } from "@/lib/vote-events";
import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { logAudit } from "@/lib/audit";
import { notifyVote } from "@/lib/notifications";
import { requireCsrfToken } from "@/lib/csrf";

async function isDeadlinePassed(projectId: string): Promise<boolean> {
  const project = await db
    .select({ deadline: projects.deadline })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project[0]?.deadline) return false;
  return new Date(project[0].deadline).getTime() < Date.now();
}

async function resolveProposalProject(
  proposalId: string
): Promise<string | null> {
  const row = await db
    .select({ projectId: proposals.projectId })
    .from(proposals)
    .where(eq(proposals.id, proposalId))
    .limit(1);
  return row[0]?.projectId ?? null;
}

async function emitVoteUpdate(
  proposalId: string,
  projectId: string
): Promise<void> {
  const result = await db
    .select({
      upvotes: sql<number>`COALESCE(SUM(CASE WHEN ${votes.value} = 1 THEN 1 ELSE 0 END), 0)`,
      downvotes: sql<number>`COALESCE(SUM(CASE WHEN ${votes.value} = -1 THEN 1 ELSE 0 END), 0)`,
    })
    .from(votes)
    .where(eq(votes.proposalId, proposalId));

  emitVoteChange({
    proposalId,
    projectId,
    upvotes: Number(result[0]?.upvotes ?? 0),
    downvotes: Number(result[0]?.downvotes ?? 0),
  });
}

const proposalSchema = z.object({
  projectId: z.string().min(1),
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(200, "Title too long"),
  description: z.string().max(5000, "Description too long").optional(),
  initialVote: z.enum(["1", "-1"]),
});

export async function createProposal(
  prevState: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireCsrfToken(formData.get("csrfToken") as string);
    const user = await requireAuth();

    if (!hasPermission(user.role as Role, "proposal:create")) {
      return { error: "You don't have permission to create proposals" };
    }

    const data = {
      projectId: formData.get("projectId") as string,
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      initialVote: (formData.get("initialVote") as string) || "1",
    };

    const result = proposalSchema.safeParse(data);
    if (!result.success) {
      return { error: result.error.issues[0].message };
    }

    const { projectId, title, description, initialVote } = result.data;

    if (await isDeadlinePassed(projectId)) {
      return { error: "Proposals are closed — the project deadline has passed" };
    }

    const summary = await buildProposalSummary(title, description);
    const proposalId = randomUUID();

    await db.insert(proposals).values({
      id: proposalId,
      projectId,
      title,
      description: description || null,
      summary,
      userId: user.id,
    });

    await db.insert(votes).values({
      proposalId,
      userId: user.id,
      value: parseInt(initialVote),
    });

    await logAudit({
      userId: user.id,
      action: "create",
      entity: "proposal",
      entityId: proposalId,
      details: JSON.stringify({ title, projectId }),
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { error: "You must be logged in to create a proposal" };
    }
    if (error instanceof Error && error.message.startsWith("Forbidden:")) {
      return { error: error.message };
    }
    return { error: "Failed to create proposal. Please try again." };
  }
}

export async function deleteProposal(
  proposalId: string,
  projectId: string,
  csrfToken: string
) {
  try {
    await requireCsrfToken(csrfToken);
    const user = await requireAuth();

    if (!hasPermission(user.role as Role, "proposal:delete")) {
      return { error: "You don't have permission to delete proposals" };
    }

    const existing = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (existing.length === 0) {
      return { error: "Proposal not found" };
    }

    if (!canManageResource(user.role as Role, existing[0].userId, user.id)) {
      return { error: "You don't have permission to delete this proposal" };
    }

    await db.delete(proposals).where(eq(proposals.id, proposalId));

    await logAudit({
      userId: user.id,
      action: "delete",
      entity: "proposal",
      entityId: proposalId,
      details: JSON.stringify({ projectId }),
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { error: "You must be logged in" };
    }
    return { error: "Failed to delete proposal" };
  }
}

export async function castVote(
  proposalId: string,
  value: number,
  _projectId: string,
  csrfToken: string
) {
  try {
    await requireCsrfToken(csrfToken);
    const user = await requireAuth();

    if (!hasPermission(user.role as Role, "vote:cast")) {
      return { error: "You don't have permission to vote" };
    }

    if (value !== 1 && value !== -1) {
      return { error: "Invalid vote value — must be 1 or -1" };
    }

    const projectId = await resolveProposalProject(proposalId);
    if (!projectId) {
      return { error: "Proposal not found" };
    }

    if (await isDeadlinePassed(projectId)) {
      return { error: "Voting is closed — the project deadline has passed" };
    }

    await db
      .insert(votes)
      .values({ proposalId, userId: user.id, value })
      .onConflictDoUpdate({
        target: [votes.proposalId, votes.userId],
        set: { value },
      });

    await logAudit({
      userId: user.id,
      action: "vote",
      entity: "vote",
      entityId: proposalId,
      details: JSON.stringify({ value, projectId }),
    });

    await emitVoteUpdate(proposalId, projectId);
    notifyVote(proposalId, projectId, user.id, value);
    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { error: "You must be logged in to vote" };
    }
    return { error: "Failed to cast vote" };
  }
}

export async function removeVote(
  proposalId: string,
  _projectId: string,
  csrfToken: string
) {
  try {
    await requireCsrfToken(csrfToken);
    const user = await requireAuth();

    if (!hasPermission(user.role as Role, "vote:cast")) {
      return { error: "You don't have permission to vote" };
    }

    const projectId = await resolveProposalProject(proposalId);
    if (!projectId) {
      return { error: "Proposal not found" };
    }

    if (await isDeadlinePassed(projectId)) {
      return { error: "Voting is closed — the project deadline has passed" };
    }

    await db
      .delete(votes)
      .where(
        and(eq(votes.proposalId, proposalId), eq(votes.userId, user.id))
      );

    await logAudit({
      userId: user.id,
      action: "unvote",
      entity: "vote",
      entityId: proposalId,
      details: JSON.stringify({ projectId }),
    });

    await emitVoteUpdate(proposalId, projectId);
    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { error: "You must be logged in" };
    }
    return { error: "Failed to remove vote" };
  }
}
