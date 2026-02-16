import { db } from "@/db";
import { projects, proposals, votes, comments, users } from "@/db/schema";
import { eq, desc, sql, count } from "drizzle-orm";

/**
 * Fetch all data needed for the dashboard page in parallel.
 */
export async function getDashboardData(userId: string) {
  const [
    userProjects,
    userProposals,
    userVoteCount,
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
    db
      .select({
        id: comments.id,
        content: comments.content,
        createdAt: comments.createdAt,
        userName: users.firstName,
        userEmail: users.email,
        proposalTitle: proposals.title,
        projectId: proposals.projectId,
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .leftJoin(proposals, eq(comments.proposalId, proposals.id))
      .orderBy(desc(comments.createdAt))
      .limit(10),
    db
      .select({
        projectCount: sql<number>`(SELECT COUNT(*) FROM projects)`,
        proposalCount: sql<number>`(SELECT COUNT(*) FROM proposals)`,
        voteCount: sql<number>`(SELECT COUNT(*) FROM votes)`,
        commentCount: sql<number>`(SELECT COUNT(*) FROM comments)`,
      })
      .from(sql`(SELECT 1)`),
  ]);

  return {
    userProjects,
    userProposals,
    userVoteCount: userVoteCount[0]?.total ?? 0,
    recentVotes,
    recentActivity,
    stats: totalStats[0],
  };
}
