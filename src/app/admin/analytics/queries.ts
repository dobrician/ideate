import { db } from "@/db";
import { users, projects, proposals, votes, comments } from "@/db/schema";
import { sql, asc, desc, gte, count } from "drizzle-orm";

const thirtyDaysAgo = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const ninetyDaysAgo = () => new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

export async function getAnalyticsData() {
  const d30 = thirtyDaysAgo();
  const d90 = ninetyDaysAgo();
  const d30Unix = Math.floor(d30.getTime() / 1000);
  const d90Unix = Math.floor(d90.getTime() / 1000);

  const [
    totals, proposalTrend, voteTrend, userGrowth,
    projectHealth, topContributors, engagementByDay,
  ] = await Promise.all([
    db.select({
      users: sql<number>`(SELECT COUNT(*) FROM users)`,
      projects: sql<number>`(SELECT COUNT(*) FROM projects)`,
      proposals: sql<number>`(SELECT COUNT(*) FROM proposals)`,
      votes: sql<number>`(SELECT COUNT(*) FROM votes)`,
      comments: sql<number>`(SELECT COUNT(*) FROM comments)`,
      activeProjects: sql<number>`(SELECT COUNT(*) FROM projects WHERE status = 'active')`,
      newUsers30d: sql<number>`(SELECT COUNT(*) FROM users WHERE created_at >= ${d30Unix})`,
      newProposals30d: sql<number>`(SELECT COUNT(*) FROM proposals WHERE created_at >= ${d30Unix})`,
    }).from(sql`(SELECT 1)`),

    // Proposals per week (last 90 days)
    db.select({
      week: sql<string>`strftime('%Y-W%W', created_at, 'unixepoch')`.as("week"),
      count: count(),
    }).from(proposals)
      .where(gte(proposals.createdAt, d90))
      .groupBy(sql`strftime('%Y-W%W', created_at, 'unixepoch')`)
      .orderBy(asc(sql`strftime('%Y-W%W', created_at, 'unixepoch')`)),

    // Votes per day (last 30 days)
    db.select({
      date: sql<string>`date(created_at, 'unixepoch')`.as("date"),
      pro: sql<number>`SUM(CASE WHEN value = 1 THEN 1 ELSE 0 END)`.as("pro"),
      contra: sql<number>`SUM(CASE WHEN value = -1 THEN 1 ELSE 0 END)`.as("contra"),
    }).from(votes)
      .where(gte(votes.createdAt, d30))
      .groupBy(sql`date(created_at, 'unixepoch')`)
      .orderBy(asc(sql`date(created_at, 'unixepoch')`)),

    // User registrations per week (last 90 days)
    db.select({
      week: sql<string>`strftime('%Y-W%W', created_at, 'unixepoch')`.as("week"),
      count: count(),
    }).from(users)
      .where(gte(users.createdAt, d90))
      .groupBy(sql`strftime('%Y-W%W', created_at, 'unixepoch')`)
      .orderBy(asc(sql`strftime('%Y-W%W', created_at, 'unixepoch')`)),

    // Project health: active projects with proposals + votes counts
    db.select({
      id: projects.id,
      title: projects.title,
      status: projects.status,
      proposalCount: sql<number>`(SELECT COUNT(*) FROM proposals WHERE proposals.project_id = projects.id)`,
      voteCount: sql<number>`(SELECT COUNT(*) FROM votes WHERE votes.proposal_id IN (SELECT id FROM proposals WHERE proposals.project_id = projects.id))`,
      commentCount: sql<number>`(SELECT COUNT(*) FROM comments WHERE comments.project_id = projects.id)`,
    }).from(projects).orderBy(desc(sql`proposalCount + voteCount + commentCount`)).limit(10),

    // Top contributors (last 30 days)
    db.select({
      date: sql<string>`date(created_at, 'unixepoch')`.as("date"),
      count: sql<number>`COUNT(*)`.as("count"),
    }).from(
      sql`(
        SELECT ${votes.createdAt} as created_at FROM ${votes} WHERE ${votes.createdAt} >= ${d30Unix}
        UNION ALL
        SELECT ${comments.createdAt} as created_at FROM ${comments} WHERE ${comments.createdAt} >= ${d30Unix}
        UNION ALL
        SELECT ${proposals.createdAt} as created_at FROM ${proposals} WHERE ${proposals.createdAt} >= ${d30Unix}
      )`
    ).groupBy(sql`date(created_at, 'unixepoch')`)
      .orderBy(asc(sql`date(created_at, 'unixepoch')`)),

    // Engagement by day of week
    db.select({
      dayOfWeek: sql<number>`CAST(strftime('%w', created_at, 'unixepoch') AS INTEGER)`.as("dayOfWeek"),
      count: sql<number>`COUNT(*)`.as("count"),
    }).from(
      sql`(
        SELECT ${votes.createdAt} as created_at FROM ${votes}
        UNION ALL
        SELECT ${comments.createdAt} as created_at FROM ${comments}
      )`
    ).groupBy(sql`strftime('%w', created_at, 'unixepoch')`),
  ]);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return {
    totals: totals[0],
    proposalTrend: proposalTrend.map((r) => ({ week: r.week, count: Number(r.count) })),
    voteTrend: voteTrend.map((r) => ({ date: r.date, pro: Number(r.pro), contra: Number(r.contra) })),
    userGrowth: userGrowth.map((r) => ({ week: r.week, count: Number(r.count) })),
    projectHealth: projectHealth.map((r) => ({
      title: r.title.length > 20 ? r.title.slice(0, 20) + "..." : r.title,
      proposals: Number(r.proposalCount), votes: Number(r.voteCount), comments: Number(r.commentCount),
    })),
    activityTrend: topContributors.map((r) => ({ date: r.date, count: Number(r.count) })),
    engagementByDay: dayNames.map((name, i) => ({
      day: name,
      count: Number(engagementByDay.find((r) => Number(r.dayOfWeek) === i)?.count ?? 0),
    })),
  };
}
