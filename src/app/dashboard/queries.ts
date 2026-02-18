import { db } from "@/db";
import { projects, proposals, votes, comments, users } from "@/db/schema";
import { eq, desc, asc, sql, count, or, inArray, gte } from "drizzle-orm";

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
      .select({
        id: projects.id,
        title: projects.title,
        description: projects.description,
        status: projects.status,
        deadline: projects.deadline,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        userId: projects.userId,
        proposalCount: sql<number>`(SELECT COUNT(*) FROM proposals WHERE proposals.project_id = projects.id)`,
        voteCount: sql<number>`(SELECT COUNT(*) FROM votes WHERE votes.proposal_id IN (SELECT id FROM proposals WHERE proposals.project_id = projects.id))`,
        commentCount: sql<number>`(SELECT COUNT(*) FROM comments WHERE comments.project_id = projects.id)`,
      })
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(asc(projects.deadline), desc(projects.createdAt))
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
        projectTitle: projects.title,
        createdAt: votes.createdAt,
      })
      .from(votes)
      .innerJoin(proposals, eq(votes.proposalId, proposals.id))
      .leftJoin(projects, eq(proposals.projectId, projects.id))
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

/**
 * Fetch chart data for the dashboard analytics section.
 */
export async function getChartData() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgoUnix = Math.floor(thirtyDaysAgo.getTime() / 1000);

  const [votesOverTime, topProposals, activityHeatmap] = await Promise.all([
    // Votes per day (last 30 days)
    db
      .select({
        date: sql<string>`date(${votes.createdAt}, 'unixepoch')`.as("date"),
        pro: sql<number>`SUM(CASE WHEN ${votes.value} = 1 THEN 1 ELSE 0 END)`.as("pro"),
        contra: sql<number>`SUM(CASE WHEN ${votes.value} = -1 THEN 1 ELSE 0 END)`.as("contra"),
      })
      .from(votes)
      .where(gte(votes.createdAt, thirtyDaysAgo))
      .groupBy(sql`date(${votes.createdAt}, 'unixepoch')`)
      .orderBy(asc(sql`date(${votes.createdAt}, 'unixepoch')`)),

    // Top 8 proposals by total votes
    db
      .select({
        title: proposals.title,
        pro: sql<number>`SUM(CASE WHEN ${votes.value} = 1 THEN 1 ELSE 0 END)`.as("pro"),
        contra: sql<number>`SUM(CASE WHEN ${votes.value} = -1 THEN 1 ELSE 0 END)`.as("contra"),
      })
      .from(proposals)
      .innerJoin(votes, eq(votes.proposalId, proposals.id))
      .groupBy(proposals.id)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(8),

    // Activity heatmap: actions per day (last 30 days) — votes + comments
    db
      .select({
        date: sql<string>`date(created_at, 'unixepoch')`.as("date"),
        count: sql<number>`COUNT(*)`.as("count"),
      })
      .from(
        sql`(
          SELECT ${votes.createdAt} as created_at FROM ${votes} WHERE ${votes.createdAt} >= ${thirtyDaysAgoUnix}
          UNION ALL
          SELECT ${comments.createdAt} as created_at FROM ${comments} WHERE ${comments.createdAt} >= ${thirtyDaysAgoUnix}
        )`
      )
      .groupBy(sql`date(created_at, 'unixepoch')`)
      .orderBy(asc(sql`date(created_at, 'unixepoch')`)),
  ]);

  return {
    votesOverTime: votesOverTime.map((r) => ({
      date: r.date,
      pro: Number(r.pro),
      contra: Number(r.contra),
    })),
    topProposals: topProposals.map((r) => ({
      title: r.title.length > 25 ? r.title.slice(0, 25) + "..." : r.title,
      pro: Number(r.pro),
      contra: Number(r.contra),
    })),
    activityHeatmap: activityHeatmap.map((r) => ({
      date: r.date,
      count: Number(r.count),
    })),
  };
}
