import { db } from "@/db";
import { projects, proposals, votes, comments, users, attachments, proposalTags, tags, proposalWorkflowState, workflowStages } from "@/db/schema";
import { eq, desc, asc, sql, count, and, inArray } from "drizzle-orm";

export const PROPOSALS_PAGE_SIZE = 20;

export interface AttachmentInfo {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

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
    avatarUrl?: string;
    createdAt: Date | null;
  }[];
  authorName: string;
  attachments: AttachmentInfo[];
  tags: { id: string; name: string }[];
}

/**
 * Fetch proposals with vote counts, user votes, and comments for a project.
 * Supports pagination via limit/offset.
 */
export type ProposalSort = "votes" | "newest" | "oldest" | "comments" | "controversy";

const VALID_SORTS: ProposalSort[] = ["votes", "newest", "oldest", "comments", "controversy"];

export function isValidSort(s: string): s is ProposalSort {
  return VALID_SORTS.includes(s as ProposalSort);
}

export async function getProjectProposals(
  projectId: string,
  currentUserId: string | null,
  limit = PROPOSALS_PAGE_SIZE,
  offset = 0,
  sort: ProposalSort = "votes",
  filterTagId?: string,
): Promise<{ proposals: ProposalWithStats[]; total: number }> {
  // Build ORDER BY based on sort parameter
  const upExpr = sql`COALESCE(SUM(CASE WHEN ${votes.value} = 1 THEN 1 ELSE 0 END), 0)`;
  const downExpr = sql`COALESCE(SUM(CASE WHEN ${votes.value} = -1 THEN 1 ELSE 0 END), 0)`;
  const netExpr = sql`(${upExpr} - ${downExpr})`;
  const totalVotesExpr = sql`(${upExpr} + ${downExpr})`;
  // Controversy: closest to 50/50 split → minimize abs(up - down) / total,
  // prioritize proposals with more total votes
  const controversyExpr = sql`CASE WHEN (${totalVotesExpr}) = 0 THEN 999999 ELSE ABS(${upExpr} - ${downExpr}) * 1.0 / (${totalVotesExpr}) END`;

  const orderClauses = (() => {
    switch (sort) {
      case "newest":
        return [desc(proposals.createdAt)];
      case "oldest":
        return [asc(proposals.createdAt)];
      case "controversy":
        return [sql`${controversyExpr} ASC`, sql`${totalVotesExpr} DESC`];
      // "comments" sort is done post-query since comment count is fetched separately
      case "comments":
      case "votes":
      default:
        return [sql`${netExpr} DESC`, desc(proposals.createdAt)];
    }
  })();

  const [proposalRows, totalResult] = await Promise.all([
    db
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
      .where(filterTagId
        ? and(eq(proposals.projectId, projectId), inArray(proposals.id,
            db.select({ pid: proposalTags.proposalId }).from(proposalTags).where(eq(proposalTags.tagId, filterTagId))
          ))
        : eq(proposals.projectId, projectId))
      .groupBy(proposals.id)
      .orderBy(...orderClauses)
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(proposals).where(filterTagId
      ? and(eq(proposals.projectId, projectId), inArray(proposals.id,
          db.select({ pid: proposalTags.proposalId }).from(proposalTags).where(eq(proposalTags.tagId, filterTagId))
        ))
      : eq(proposals.projectId, projectId)),
  ]);

  const total = totalResult[0]?.total ?? 0;

  const userVoteRows = currentUserId
    ? await db
        .select({ proposalId: votes.proposalId, value: votes.value })
        .from(votes)
        .where(eq(votes.userId, currentUserId))
    : [];
  const voteMap = new Map(userVoteRows.map((v) => [v.proposalId, v.value]));

  const proposalIds = proposalRows.map((p) => p.id);
  let allComments: {
    id: string;
    proposalId: string | null;
    parentId: string | null;
    content: string;
    userId: string | null;
    createdAt: Date | null;
    userEmail: string | null;
    userName: string | null;
    avatarUrl: string | null;
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
        avatarUrl: users.avatarUrl,
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
    if (!c.proposalId) continue;
    const list = commentsByProposal.get(c.proposalId) || [];
    list.push(c);
    commentsByProposal.set(c.proposalId, list);
  }

  // Fetch attachments for all proposals on this page
  let allAttachments: {
    id: string;
    proposalId: string;
    filename: string;
    mimeType: string;
    size: number;
  }[] = [];

  if (proposalIds.length > 0) {
    allAttachments = await db
      .select({
        id: attachments.id,
        proposalId: attachments.proposalId,
        filename: attachments.filename,
        mimeType: attachments.mimeType,
        size: attachments.size,
      })
      .from(attachments)
      .where(
        sql`${attachments.proposalId} IN (${sql.join(
          proposalIds.map((pid) => sql`${pid}`),
          sql`, `
        )})`
      )
      .orderBy(attachments.createdAt);
  }

  const attachmentsByProposal = new Map<string, AttachmentInfo[]>();
  for (const a of allAttachments) {
    const list = attachmentsByProposal.get(a.proposalId) || [];
    list.push({ id: a.id, filename: a.filename, mimeType: a.mimeType, size: a.size });
    attachmentsByProposal.set(a.proposalId, list);
  }

  // Fetch tags for all proposals on this page
  const tagsByProposal = new Map<string, { id: string; name: string }[]>();
  if (proposalIds.length > 0) {
    const allPropTags = await db
      .select({
        proposalId: proposalTags.proposalId,
        tagId: tags.id,
        tagName: tags.name,
      })
      .from(proposalTags)
      .innerJoin(tags, eq(proposalTags.tagId, tags.id))
      .where(
        sql`${proposalTags.proposalId} IN (${sql.join(
          proposalIds.map((pid) => sql`${pid}`),
          sql`, `
        )})`
      );
    for (const pt of allPropTags) {
      const list = tagsByProposal.get(pt.proposalId) || [];
      list.push({ id: pt.tagId, name: pt.tagName });
      tagsByProposal.set(pt.proposalId, list);
    }
  }

  // Fetch workflow state for all proposals on this page
  const workflowStateMap = new Map<string, { currentStageName: string; status: string; stageIndex: number; totalStages: number }>();
  if (proposalIds.length > 0) {
    const stateRows = await db
      .select({
        proposalId: proposalWorkflowState.proposalId,
        status: proposalWorkflowState.status,
        currentStageId: proposalWorkflowState.currentStageId,
        stageName: workflowStages.name,
        stageOrder: workflowStages.stageOrder,
        workflowId: proposalWorkflowState.workflowId,
      })
      .from(proposalWorkflowState)
      .innerJoin(workflowStages, eq(proposalWorkflowState.currentStageId, workflowStages.id))
      .where(
        sql`${proposalWorkflowState.proposalId} IN (${sql.join(
          proposalIds.map((pid) => sql`${pid}`),
          sql`, `
        )})`
      );
    // Count total stages per workflow
    const wfIds = [...new Set(stateRows.map((r) => r.workflowId))];
    const stageCounts = new Map<string, number>();
    if (wfIds.length > 0) {
      const countRows = await db
        .select({ workflowId: workflowStages.workflowId, cnt: count() })
        .from(workflowStages)
        .where(sql`${workflowStages.workflowId} IN (${sql.join(wfIds.map((id) => sql`${id}`), sql`, `)})`)
        .groupBy(workflowStages.workflowId);
      for (const r of countRows) stageCounts.set(r.workflowId, r.cnt);
    }
    for (const r of stateRows) {
      workflowStateMap.set(r.proposalId, {
        currentStageName: r.stageName,
        status: r.status,
        stageIndex: r.stageOrder,
        totalStages: stageCounts.get(r.workflowId) ?? 1,
      });
    }
  }

  const mapped = proposalRows.map((p) => {
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
        avatarUrl: c.avatarUrl ?? undefined,
        createdAt: c.createdAt,
      })),
      authorName,
      attachments: attachmentsByProposal.get(p.id) || [],
      tags: tagsByProposal.get(p.id) || [],
      workflowState: workflowStateMap.get(p.id) ?? null,
    };
  });

  // Post-query sort for "comments" mode (comment counts come from separate query)
  if (sort === "comments") {
    mapped.sort((a, b) => b.commentCount - a.commentCount);
  }

  return { total, proposals: mapped };
}
