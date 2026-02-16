import { db } from "@/db";
import { projects, proposals, votes, comments, users } from "@/db/schema";
import { eq, desc, sql, count, or, inArray } from "drizzle-orm";

/**
 * Fetch all data needed for the dashboard page in parallel.
 */
export async function getDashboardData(userId: string) {
  const [
    userProjects,
    userProposals,
    userVoteCount,
    userCommentCount,
    recentVotes,
    recentActivity,
    totalStats,
  ] = await Promise.all([
    db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.createdAt))
      .limit(5),
    db
      .select({
        id: proposals.id,
        title: proposals.title,
        projectId: proposals.projectId,
        projectTitle: projects.title,
        createdAt: proposals.createdAt,
      })
      .from(proposals)
      .leftJoin(projects, eq(proposals.projectId, projects.id))
      .where(eq(proposals.userId, userId))
      .orderBy(desc(proposals.createdAt))
      .limit(5),
    db
      .select({ total: count() })
      .from(votes)
      .where(eq(votes.userId, userId)),
    db
      .select({ total: count() })
      .from(comments)
      .where(eq(comments.userId, userId)),
    db
      .select({
        proposalId: votes.proposalId,
        value: votes.value,
        proposalTitle: proposals.title,
        projectId: proposals.projectId,
        createdAt: votes.createdAt,
      })
      .from(votes)
      .innerJoin(proposals, eq(votes.proposalId, proposals.id))
      .where(eq(votes.userId, userId))
      .orderBy(desc(votes.createdAt))
      .limit(8),
    getRecentActivity(userId),
    db
      .select({
        projectCount: sql<number>`(SELECT COUNT(*) FROM projects)`,
        proposalCount: sql<number>`(SELECT COUNT(*) FROM proposals)`,
        voteCount: sql<number>`(SELECT COUNT(*) FROM votes)`,
        commentCount: sql<number>`(SELECT COUNT(*) FROM comments)`,
      })
      .from(sql`(SELECT 1)`),
  ]);

  const platformStats = totalStats[0];
  return {
    userProjects,
    userProposals,
    userVoteCount: userVoteCount[0]?.total ?? 0,
    userCommentCount: userCommentCount[0]?.total ?? 0,
    recentVotes,
    recentActivity,
    userStats: {
      projectCount: userProjects.length,
      proposalCount: userProposals.length,
      voteCount: userVoteCount[0]?.total ?? 0,
      commentCount: userCommentCount[0]?.total ?? 0,
    },
    platformStats: {
      projectCount: Number(platformStats?.projectCount ?? 0),
      proposalCount: Number(platformStats?.proposalCount ?? 0),
      voteCount: Number(platformStats?.voteCount ?? 0),
      commentCount: Number(platformStats?.commentCount ?? 0),
    },
  };
}

const activityColumns = {
  id: comments.id,
  content: comments.content,
  createdAt: comments.createdAt,
  userName: users.firstName,
  userEmail: users.email,
  proposalTitle: proposals.title,
  projectId: proposals.projectId,
};

/**
 * Get recent activity scoped to the user's projects/proposals.
 * Falls back to global activity when the user has no projects yet.
 */
async function getRecentActivity(userId: string) {
  const ownProjectIds = db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.userId, userId));

  const ownProposalIds = db
    .select({ id: proposals.id })
    .from(proposals)
    .where(eq(proposals.userId, userId));

  const scoped = await db
    .select(activityColumns)
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .leftJoin(proposals, eq(comments.proposalId, proposals.id))
    .where(
      or(
        inArray(comments.projectId, ownProjectIds),
        inArray(comments.proposalId, ownProposalIds),
      ),
    )
    .orderBy(desc(comments.createdAt))
    .limit(10);

  if (scoped.length > 0) return scoped;

  // Fallback: global activity for users with no projects/proposals
  return db
    .select(activityColumns)
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .leftJoin(proposals, eq(comments.proposalId, proposals.id))
    .orderBy(desc(comments.createdAt))
    .limit(10);
}
