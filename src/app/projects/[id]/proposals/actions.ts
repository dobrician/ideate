"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { proposals, votes, proposalTags } from "@/db/schema";
import { canManageResource } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { buildProposalSummary } from "@/lib/ai";
import { emitVoteUpdate } from "@/lib/vote-update";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { logAudit } from "@/lib/audit";
import { notifyVote } from "@/lib/notifications";
import { isDeadlinePassed, isProjectArchived } from "@/lib/project-utils";
import { fireWebhookEvent } from "@/lib/webhooks";
import { withActionAuth } from "@/lib/action-wrapper";

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
  return withActionAuth(formData.get("csrfToken") as string, {
    permission: "proposal:create",
    rateLimitKey: "proposal:create",
    rateLimitMax: 20,
  }, async (user) => {
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

    if (await isProjectArchived(projectId)) {
      return { error: "This project is archived and read-only" };
    }

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

    const tagIds = (formData.get("tagIds") as string || "").split(",").filter(Boolean);
    if (tagIds.length > 0) {
      await db.insert(proposalTags).values(
        tagIds.map((tagId) => ({ proposalId, tagId }))
      );
    }

    await logAudit({
      userId: user.id,
      action: "create",
      entity: "proposal",
      entityId: proposalId,
      details: JSON.stringify({ title, projectId }),
    });

    fireWebhookEvent("proposal.created", { proposalId, title, projectId, userId: user.id }).catch((err) => logger.warn({ err }, "Webhook delivery failed"));

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  });
}

export async function deleteProposal(
  proposalId: string,
  projectId: string,
  csrfToken: string
) {
  return withActionAuth(csrfToken, {
    permission: "proposal:delete",
    rateLimitKey: "proposal:delete",
    rateLimitMax: 20,
  }, async (user) => {
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
  });
}

export async function castVote(
  proposalId: string,
  value: number,
  _projectId: string,
  csrfToken: string
) {
  return withActionAuth(csrfToken, {
    permission: "vote:cast",
    rateLimitKey: "vote:cast",
    rateLimitMax: 60,
  }, async (user) => {
    if (value !== 1 && value !== -1) {
      return { error: "Invalid vote value — must be 1 or -1" };
    }

    const projectId = await resolveProposalProject(proposalId);
    if (!projectId) {
      return { error: "Proposal not found" };
    }

    if (await isProjectArchived(projectId)) {
      return { error: "This project is archived and read-only" };
    }

    if (await isDeadlinePassed(projectId)) {
      return { error: "Voting is closed — the project deadline has passed" };
    }

    await db
      .insert(votes)
      .values({ proposalId, userId: user.id, value })
      .onConflictDoUpdate({
        target: [votes.proposalId, votes.userId],
        set: { value, updatedAt: new Date() },
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
    fireWebhookEvent("vote.cast", { proposalId, projectId, userId: user.id, value }).catch((err) => logger.warn({ err }, "Webhook delivery failed"));
    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  });
}

export async function removeVote(
  proposalId: string,
  _projectId: string,
  csrfToken: string
) {
  return withActionAuth(csrfToken, {
    permission: "vote:cast",
    rateLimitKey: "vote:remove",
    rateLimitMax: 60,
  }, async (user) => {
    const projectId = await resolveProposalProject(proposalId);
    if (!projectId) {
      return { error: "Proposal not found" };
    }

    if (await isProjectArchived(projectId)) {
      return { error: "This project is archived and read-only" };
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
  });
}
