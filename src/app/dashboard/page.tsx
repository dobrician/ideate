import { redirect } from "next/navigation";
import { db } from "@/db";
import { projects, proposals, votes, comments, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, desc, sql, count } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  FolderOpen,
  Lightbulb,
  ThumbsUp,
  MessageSquare,
} from "lucide-react";
import { StatCard, formatRelativeTime } from "@/components/stat-card";
import { getTranslations } from "@/lib/i18n-server";

/**
 * Dashboard page showing user overview, recent votes, and activity feed
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const { t } = await getTranslations();

  // Parallel queries for dashboard stats
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
      .where(eq(projects.userId, user.id))
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
      .where(eq(proposals.userId, user.id))
      .orderBy(desc(proposals.createdAt))
      .limit(5),
    db
      .select({ total: count() })
      .from(votes)
      .where(eq(votes.userId, user.id)),
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
      .where(eq(votes.userId, user.id))
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

  const stats = totalStats[0];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground">
          {t("dashboard.welcomeBack", { name: user.firstName || user.email })}
        </p>
      </div>

      {/* Stats cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" role="region" aria-label="Platform statistics">
        <StatCard
          title={t("dashboard.stats.projects")}
          value={Number(stats?.projectCount ?? 0)}
          icon={<FolderOpen className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title={t("dashboard.stats.proposals")}
          value={Number(stats?.proposalCount ?? 0)}
          icon={<Lightbulb className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title={t("dashboard.stats.votes")}
          value={Number(stats?.voteCount ?? 0)}
          icon={<ThumbsUp className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title={t("dashboard.stats.comments")}
          value={Number(stats?.commentCount ?? 0)}
          icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* User's projects */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("dashboard.yourProjects")}</CardTitle>
            <CardDescription>
              {userProjects.length} project{userProjects.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {userProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("dashboard.noProjects")}{" "}
                <Link href="/projects/new" className="underline">
                  {t("dashboard.createOne")}
                </Link>
              </p>
            ) : (
              <ul className="space-y-3" role="list">
                {userProjects.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}`}
                      className="group flex items-center justify-between rounded-md px-2 py-1 transition-colors hover:bg-muted/50"
                    >
                      <span className="truncate text-sm font-medium group-hover:underline">
                        {p.title}
                      </span>
                      <Badge variant="outline" className="shrink-0">
                        {p.status}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* User's proposals */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("dashboard.yourProposals")}</CardTitle>
            <CardDescription>
              {userProposals.length} recent proposal{userProposals.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {userProposals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("dashboard.noProposals")}
              </p>
            ) : (
              <ul className="space-y-3" role="list">
                {userProposals.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.projectId}`}
                      className="group block rounded-md px-2 py-1 transition-colors hover:bg-muted/50"
                    >
                      <span className="truncate text-sm font-medium group-hover:underline">
                        {p.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        in {p.projectTitle ?? "Unknown project"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent votes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("dashboard.recentVotes")}</CardTitle>
            <CardDescription>
              {t("dashboard.totalVotes", { count: userVoteCount[0]?.total ?? 0 })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentVotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("dashboard.noVotes")}
              </p>
            ) : (
              <ul className="space-y-3" role="list">
                {recentVotes.map((v) => (
                  <li
                    key={`${v.proposalId}-${v.createdAt?.getTime()}`}
                    className="flex items-center gap-2"
                  >
                    <Badge
                      variant={v.value === 1 ? "default" : "destructive"}
                      className="shrink-0"
                    >
                      {v.value === 1 ? "+1" : "-1"}
                    </Badge>
                    <Link
                      href={`/projects/${v.projectId}`}
                      className="truncate text-sm transition-colors hover:underline"
                    >
                      {v.proposalTitle}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Activity feed */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("dashboard.activity")}</CardTitle>
            <CardDescription>{t("dashboard.activityDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.noActivity")}</p>
            ) : (
              <ul className="space-y-3" role="list">
                {recentActivity.map((a) => (
                  <li key={a.id} className="text-sm">
                    <Link
                      href={`/projects/${a.projectId}`}
                      className="group block rounded-md px-2 py-1 transition-colors hover:bg-muted/50"
                    >
                      <span className="font-medium group-hover:underline">
                        {a.userName || a.userEmail || "Someone"}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}{t("dashboard.commentedOn")}{" "}
                      </span>
                      <span className="font-medium group-hover:underline">
                        {a.proposalTitle}
                      </span>
                      {a.createdAt && (
                        <time className="ml-1 text-xs text-muted-foreground" dateTime={a.createdAt.toISOString()}>
                          {formatRelativeTime(a.createdAt)}
                        </time>
                      )}
                    </Link>
                    <p className="mt-0.5 line-clamp-1 px-2 text-muted-foreground">
                      {a.content}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
