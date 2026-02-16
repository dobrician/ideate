import { db } from "@/db";
import { projects, proposals, votes, comments, users } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";

export interface ProposalWithStats {
  id: string;
  title: string;
  description: string | null;
  summary: string | null;
  userId: string | null;
  createdAt: Date | null;
  upvotes: number;
  downvotes: number;
  userVote: number | null;
  commentCount: number;
  comments: {
    id: string;
    content: string;
    parentId: string | null;
    userId: string | null;
    userEmail?: string;
    userName?: string;
    createdAt: Date | null;
  }[];
  authorName: string;
}

/**
 * Fetch proposals with vote counts, user votes, and comments for a project.
 */
export async function getProjectProposals(
  projectId: string,
  currentUserId: string
): Promise<ProposalWithStats[]> {
  const proposalRows = await db
    .select({
      id: proposals.id,
      title: proposals.title,
      description: proposals.description,
      summary: proposals.summary,
      userId: proposals.userId,
      createdAt: proposals.createdAt,
      authorFirstName: users.firstName,
      authorLastName: users.lastName,
      authorEmail: users.email,
      upvotes: sql<number>`COALESCE(SUM(CASE WHEN ${votes.value} = 1 THEN 1 ELSE 0 END), 0)`,
      downvotes: sql<number>`COALESCE(SUM(CASE WHEN ${votes.value} = -1 THEN 1 ELSE 0 END), 0)`,
    })
    .from(proposals)
    .leftJoin(votes, eq(proposals.id, votes.proposalId))
    .leftJoin(users, eq(proposals.userId, users.id))
    .where(eq(proposals.projectId, projectId))
    .groupBy(proposals.id)
    .orderBy(desc(proposals.createdAt));

  const userVoteRows = await db
    .select({ proposalId: votes.proposalId, value: votes.value })
    .from(votes)
    .where(eq(votes.userId, currentUserId));
  const voteMap = new Map(userVoteRows.map((v) => [v.proposalId, v.value]));

  const proposalIds = proposalRows.map((p) => p.id);
  let allComments: {
    id: string;
    proposalId: string;
    parentId: string | null;
    content: string;
    userId: string | null;
    createdAt: Date | null;
    userEmail: string | null;
    userName: string | null;
  }[] = [];

  if (proposalIds.length > 0) {
    allComments = await db
      .select({
        id: comments.id,
        proposalId: comments.proposalId,
        parentId: comments.parentId,
        content: comments.content,
        userId: comments.userId,
        createdAt: comments.createdAt,
        userEmail: users.email,
        userName: users.firstName,
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(
        sql`${comments.proposalId} IN (${sql.join(
          proposalIds.map((pid) => sql`${pid}`),
          sql`, `
        )})`
      )
      .orderBy(comments.createdAt);
  }

  const commentsByProposal = new Map<string, typeof allComments>();
  for (const c of allComments) {
    const list = commentsByProposal.get(c.proposalId) || [];
    list.push(c);
    commentsByProposal.set(c.proposalId, list);
  }

  return proposalRows.map((p) => {
    const pComments = commentsByProposal.get(p.id) || [];
    const authorName =
      [p.authorFirstName, p.authorLastName].filter(Boolean).join(" ") ||
      p.authorEmail ||
      "Anonymous";

    return {
      id: p.id,
      title: p.title,
      description: p.description,
      summary: p.summary,
      userId: p.userId,
      createdAt: p.createdAt,
      upvotes: Number(p.upvotes),
      downvotes: Number(p.downvotes),
      userVote: voteMap.get(p.id) ?? null,
      commentCount: pComments.length,
      comments: pComments.map((c) => ({
        id: c.id,
        content: c.content,
        parentId: c.parentId,
        userId: c.userId,
        userEmail: c.userEmail ?? undefined,
        userName: c.userName ?? undefined,
        createdAt: c.createdAt,
      })),
      authorName,
    };
  });
}
