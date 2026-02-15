"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { proposals, votes, comments } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { buildProposalSummary } from "@/lib/ai";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

/**
 * Proposal validation schema
 */
const proposalSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(5, "Title must be at least 5 characters").max(200, "Title too long"),
  description: z.string().max(5000, "Description too long").optional(),
  initialVote: z.enum(["1", "-1"]),
});

/**
 * Comment validation schema
 */
const commentSchema = z.object({
  proposalId: z.string().min(1),
  content: z.string().min(1, "Comment cannot be empty").max(2000, "Comment too long"),
  parentId: z.string().optional(),
});

/**
 * Create a new proposal with AI summary and initial vote
 */
export async function createProposal(
  prevState: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  try {
    const user = await requireAuth();

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

    // Generate AI summary (non-blocking — falls back to truncation)
    const summary = await buildProposalSummary(title, description);

    // Insert proposal
    const proposalId = randomUUID();
    await db.insert(proposals).values({
      id: proposalId,
      projectId,
      title,
      description: description || null,
      summary,
      userId: user.id,
    });

    // Cast initial vote
    await db.insert(votes).values({
      proposalId,
      userId: user.id,
      value: parseInt(initialVote),
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { error: "You must be logged in to create a proposal" };
    }
    return { error: "Failed to create proposal. Please try again." };
  }
}

/**
 * Delete a proposal (owner or admin only)
 */
export async function deleteProposal(proposalId: string, projectId: string) {
  try {
    const user = await requireAuth();

    const existing = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (existing.length === 0) {
      return { error: "Proposal not found" };
    }

    if (existing[0].userId !== user.id && user.role !== "admin") {
      return { error: "You don't have permission to delete this proposal" };
    }

    await db.delete(proposals).where(eq(proposals.id, proposalId));
    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { error: "You must be logged in" };
    }
    return { error: "Failed to delete proposal" };
  }
}

/**
 * Cast or update a vote (upsert via onConflictDoUpdate)
 */
export async function castVote(proposalId: string, value: number, projectId: string) {
  try {
    const user = await requireAuth();

    await db
      .insert(votes)
      .values({
        proposalId,
        userId: user.id,
        value,
      })
      .onConflictDoUpdate({
        target: [votes.proposalId, votes.userId],
        set: { value },
      });

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { error: "You must be logged in to vote" };
    }
    return { error: "Failed to cast vote" };
  }
}

/**
 * Remove a vote
 */
export async function removeVote(proposalId: string, projectId: string) {
  try {
    const user = await requireAuth();

    await db
      .delete(votes)
      .where(and(eq(votes.proposalId, proposalId), eq(votes.userId, user.id)));

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { error: "You must be logged in" };
    }
    return { error: "Failed to remove vote" };
  }
}

/**
 * Add a comment to a proposal (supports threading via parentId)
 */
export async function addComment(
  prevState: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  try {
    const user = await requireAuth();

    const data = {
      proposalId: formData.get("proposalId") as string,
      content: formData.get("content") as string,
      parentId: (formData.get("parentId") as string) || undefined,
    };

    const result = commentSchema.safeParse(data);
    if (!result.success) {
      return { error: result.error.issues[0].message };
    }

    const { proposalId, content, parentId } = result.data;
    const projectId = formData.get("projectId") as string;

    await db.insert(comments).values({
      id: randomUUID(),
      proposalId,
      parentId: parentId || null,
      content,
      userId: user.id,
    });

    if (projectId) {
      revalidatePath(`/projects/${projectId}`);
    }
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { error: "You must be logged in to comment" };
    }
    return { error: "Failed to post comment" };
  }
}
