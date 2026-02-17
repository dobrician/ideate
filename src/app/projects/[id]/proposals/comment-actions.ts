"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { proposals, comments } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { logAudit } from "@/lib/audit";
import { notifyComment } from "@/lib/notifications";
import { requireCsrfToken } from "@/lib/csrf";
import { isDeadlinePassed } from "@/lib/project-utils";

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
  try {
    await requireCsrfToken(formData.get("csrfToken") as string);
    const user = await requireAuth();

    if (!hasPermission(user.role as Role, "comment:create")) {
      return { error: "You don't have permission to comment" };
    }

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
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { error: "You must be logged in to comment" };
    }
    return { error: "Failed to post comment" };
  }
}
