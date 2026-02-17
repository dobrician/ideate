import { db } from "@/db";
import { votes } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { emitVoteChange } from "@/lib/vote-events";

/**
 * Query current vote counts for a proposal and broadcast via SSE.
 * Shared by castVote/removeVote (actions.ts) and submit-suggested route.
 */
export async function emitVoteUpdate(
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
