"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { proposals, comments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { logAudit } from "@/lib/audit";
import { notifyComment } from "@/lib/notifications";
import { isDeadlinePassed, isProjectArchived } from "@/lib/project-utils";
import { withActionAuth } from "@/lib/action-wrapper";

/**
 * Comment validation schema — exactly one of proposalId or projectId required
 */
const commentSchema = z
  .object({
    proposalId: z.string().min(1).optional(),
    projectId: z.string().min(1).optional(),
    content: z
      .string()
      .min(1, "Comment cannot be empty")
      .max(2000, "Comment too long"),
    parentId: z.string().optional(),
  })
  .refine((d) => Boolean(d.proposalId) !== Boolean(d.projectId), {
    message: "Exactly one of proposalId or projectId is required",
  });

/**
 * Add a comment to a proposal or project (supports threading via parentId)
 */
export async function addComment(
  prevState: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  return withActionAuth(formData.get("csrfToken") as string, {
    permission: "comment:create",
    rateLimitKey: "comment:create",
    rateLimitMax: 30,
  }, async (user) => {
    const rawProjectId = (formData.get("projectId") as string) || undefined;
    const rawProposalId = (formData.get("proposalId") as string) || undefined;

    // Resolve projectId for deadline check — proposal comments need the parent project
    let deadlineProjectId = rawProjectId;
    if (!deadlineProjectId && rawProposalId) {
      const proposal = await db
        .select({ projectId: proposals.projectId })
        .from(proposals)
        .where(eq(proposals.id, rawProposalId))
        .limit(1);
      deadlineProjectId = proposal[0]?.projectId;
    }

    if (deadlineProjectId && (await isProjectArchived(deadlineProjectId))) {
      return { error: "This project is archived and read-only" };
    }

    if (deadlineProjectId && (await isDeadlinePassed(deadlineProjectId))) {
      return { error: "Comments are closed — the project deadline has passed" };
    }

    const data = {
      proposalId: rawProposalId,
      projectId: rawProjectId,
      content: formData.get("content") as string,
      parentId: (formData.get("parentId") as string) || undefined,
    };

    const result = commentSchema.safeParse(data);
    if (!result.success) {
      return { error: result.error.issues[0].message };
    }

    const { proposalId, projectId, content, parentId } = result.data;

    // Validate parentId: must exist and belong to the same scope
    if (parentId) {
      const parent = await db
        .select({
          id: comments.id,
          proposalId: comments.proposalId,
          projectId: comments.projectId,
        })
        .from(comments)
        .where(eq(comments.id, parentId))
        .limit(1);

      if (parent.length === 0) {
        return { error: "Parent comment not found" };
      }
      const p = parent[0];
      if (proposalId && p.proposalId !== proposalId) {
        return { error: "Parent comment belongs to a different scope" };
      }
      if (projectId && p.projectId !== projectId) {
        return { error: "Parent comment belongs to a different scope" };
      }
    }

    const isProjectComment = Boolean(projectId && !proposalId);

    await db.insert(comments).values({
      id: randomUUID(),
      proposalId: proposalId || null,
      projectId: projectId || null,
      parentId: parentId || null,
      content,
      userId: user.id,
    });

    await logAudit({
      userId: user.id,
      action: isProjectComment ? "project_comment" : "comment",
      entity: "comment",
      entityId: proposalId || projectId || "",
    });

    const revalidateProjectId = projectId || deadlineProjectId;
    if (proposalId) {
      notifyComment(proposalId, revalidateProjectId || "", user.id, content);
    }
    if (revalidateProjectId) {
      revalidatePath(`/projects/${revalidateProjectId}`);
    }
    return { success: true };
  });
}
