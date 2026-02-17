import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  FolderOpen, Lightbulb, ThumbsUp, ThumbsDown,
  MessageSquare, Plus, Compass,
} from "lucide-react";
import { StatCard, formatRelativeTime } from "@/components/stat-card";
import { getTranslations } from "@/lib/i18n-server";
import { statusBadgeClass, statusLabel, deadlineBadge } from "@/lib/status-utils";
import { getDashboardData, getChartData } from "./queries";
import { CollapsibleList } from "./collapsible-list";
import { VotesOverTimeChart, TopProposalsChart, ActivityHeatmapChart } from "./charts";

function EmptyState({ icon, text }: { icon: React.ReactNode; text: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <div className="rounded-full bg-muted p-3">{icon}</div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const { t } = await getTranslations();

  const [{
    userProjects, userProposals, userVoteCount, recentVotes, recentActivity,
    userStats, platformStats,
  }, chartData] = await Promise.all([
    getDashboardData(user.id),
    getChartData(),
  ]);

  return (
    <div className="mx-auto max-w-6xl py-4 sm:py-8">
      <div className="mb-5 sm:mb-8">
        <h1 className="text-2xl font-bold sm:text-3xl">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground">
          {t("dashboard.welcomeBack", { name: user.firstName || user.email })}
        </p>
      </div>

      {/* Mobile stat pills (compact 2x2 grid) */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:hidden" role="region" aria-label={t("dashboard.ariaStats")}>
        {[
          { icon: <FolderOpen className="h-3.5 w-3.5" />, value: userStats.projectCount, label: t("dashboard.stats.projects") },
          { icon: <Lightbulb className="h-3.5 w-3.5" />, value: userStats.proposalCount, label: t("dashboard.stats.proposals") },
          { icon: <ThumbsUp className="h-3.5 w-3.5" />, value: userStats.voteCount, label: t("dashboard.stats.votes") },
          { icon: <MessageSquare className="h-3.5 w-3.5" />, value: userStats.commentCount, label: t("dashboard.stats.comments") },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
            <span className="text-muted-foreground">{s.icon}</span>
            <span className="text-sm font-bold">{s.value}</span>
            <span className="truncate text-xs text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Desktop stat cards */}
      <div className="mb-6 hidden gap-4 sm:mb-8 sm:grid sm:grid-cols-2 lg:grid-cols-4" role="region" aria-label={t("dashboard.ariaStats")}>
        <StatCard title={t("dashboard.stats.projects")} value={userStats.projectCount}
          description={t("dashboard.stats.ofTotal", { total: platformStats.projectCount })}
          icon={<FolderOpen className="h-4 w-4 text-muted-foreground" />} />
        <StatCard title={t("dashboard.stats.proposals")} value={userStats.proposalCount}
          description={t("dashboard.stats.ofTotal", { total: platformStats.proposalCount })}
          icon={<Lightbulb className="h-4 w-4 text-muted-foreground" />} />
        <StatCard title={t("dashboard.stats.votes")} value={userStats.voteCount}
          description={t("dashboard.stats.ofTotal", { total: platformStats.voteCount })}
          icon={<ThumbsUp className="h-4 w-4 text-muted-foreground" />} />
        <StatCard title={t("dashboard.stats.comments")} value={userStats.commentCount}
          description={t("dashboard.stats.ofTotal", { total: platformStats.commentCount })}
          icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />} />
      </div>

      {/* Quick Actions */}
      <div className="mb-5 flex flex-wrap gap-2 sm:mb-8 sm:gap-3" role="region" aria-label={t("dashboard.quickActions")}>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="mr-2 h-4 w-4" />{t("dashboard.newProject")}
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/projects">
            <Compass className="mr-2 h-4 w-4" />{t("dashboard.browseProjects")}
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* User's projects */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="text-lg">{t("dashboard.yourProjects")}</CardTitle>
              <CardDescription>{t("projects.total", { count: userProjects.length })}</CardDescription>
            </div>
            <Link href="/projects" className="text-xs font-medium text-primary hover:underline">
              {t("dashboard.viewAll")}
            </Link>
          </CardHeader>
          <CardContent>
            {userProjects.length === 0 ? (
              <EmptyState
                icon={<FolderOpen className="h-5 w-5 text-muted-foreground" />}
                text={<>{t("dashboard.noProjects")}{" "}
                  <Link href="/projects/new" className="font-medium text-primary hover:underline">
                    {t("dashboard.createOne")}
                  </Link></>}
              />
            ) : (
              <ul className="space-y-2" role="list">
                <CollapsibleList total={userProjects.length}>
                  {userProjects.map((p) => (
                    <li key={p.id}>
                      <Link href={`/projects/${p.id}`}
                        className="group block rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50">
                        <span className="flex items-center justify-between">
                          <span className="truncate text-sm font-medium group-hover:underline" title={p.title}>{p.title}</span>
                          <span className="flex shrink-0 gap-1.5">
                            {(() => { const dl = deadlineBadge(p.deadline, t); return dl ? <Badge className={dl.className}>{dl.label}</Badge> : null; })()}
                            <Badge className={statusBadgeClass(p.status)}>{statusLabel(p.status, t)}</Badge>
                          </span>
                        </span>
                        <span className="mt-0.5 flex gap-3 text-xs text-muted-foreground">
                          <span>{t("dashboard.projectProposals", { count: p.proposalCount })}</span>
                          <span>{t("dashboard.projectVotes", { count: p.voteCount })}</span>
                          <span>{t("dashboard.projectComments", { count: p.commentCount })}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </CollapsibleList>
              </ul>
            )}
          </CardContent>
        </Card>

        {/* User's proposals */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("dashboard.yourProposals")}</CardTitle>
            <CardDescription>{t("proposals.count", { count: userProposals.length })}</CardDescription>
          </CardHeader>
          <CardContent>
            {userProposals.length === 0 ? (
              <EmptyState icon={<Lightbulb className="h-5 w-5 text-muted-foreground" />} text={t("dashboard.noProposals")} />
            ) : (
              <ul className="space-y-2" role="list">
                <CollapsibleList total={userProposals.length}>
                  {userProposals.map((p) => (
                    <li key={p.id}>
                      <Link href={`/projects/${p.projectId}`}
                        className="group block rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50">
                        <span className="truncate text-sm font-medium group-hover:underline" title={p.title}>{p.title}</span>
                        <span className="block truncate text-xs text-muted-foreground" title={p.projectTitle ?? ""}>
                          {t("dashboard.inProject", { project: p.projectTitle ?? t("projects.unknown") })}
                        </span>
                      </Link>
                    </li>
                  ))}
                </CollapsibleList>
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent votes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("dashboard.recentVotes")}</CardTitle>
            <CardDescription>{t("dashboard.totalVotes", { count: userVoteCount })}</CardDescription>
          </CardHeader>
          <CardContent>
            {recentVotes.length === 0 ? (
              <EmptyState icon={<ThumbsUp className="h-5 w-5 text-muted-foreground" />} text={t("dashboard.noVotes")} />
            ) : (
              <ul className="space-y-2" role="list">
                <CollapsibleList total={recentVotes.length}>
                  {recentVotes.map((v) => (
                    <li key={`${v.proposalId}-${v.createdAt?.getTime()}`}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50">
                      {v.value === 1 ? (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                          <ThumbsUp className="h-3 w-3 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
                          <span className="sr-only">{t("proposalForm.upvote")}</span>
                        </span>
                      ) : (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
                          <ThumbsDown className="h-3 w-3 text-red-700 dark:text-red-300" aria-hidden="true" />
                          <span className="sr-only">{t("proposalForm.downvote")}</span>
                        </span>
                      )}
                      <Link href={`/projects/${v.projectId}`}
                        className="min-w-0 transition-colors hover:underline">
                        <span className="block truncate text-sm">{v.proposalTitle}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {t("dashboard.inProject", { project: v.projectTitle ?? t("projects.unknown") })}
                        </span>
                      </Link>
                    </li>
                  ))}
                </CollapsibleList>
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
              <EmptyState icon={<MessageSquare className="h-5 w-5 text-muted-foreground" />} text={t("dashboard.noActivity")} />
            ) : (
              <ul className="space-y-2" role="list">
                <CollapsibleList total={recentActivity.length}>
                  {recentActivity.map((a) => (
                    <li key={a.id} className="text-sm">
                      <Link href={a.projectId ? `/projects/${a.projectId}` : "/projects"}
                        className="group flex gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50">
                        <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <div>
                            <span className="font-medium group-hover:underline">
                              {a.userName || a.userEmail || t("common.someone")}
                            </span>
                            <span className="text-muted-foreground"> {t("dashboard.commentedOn")} </span>
                            <span className="font-medium group-hover:underline">{a.proposalTitle}</span>
                            {a.createdAt && (
                              <time className="ml-1 text-xs text-muted-foreground" dateTime={a.createdAt.toISOString()}>
                                {formatRelativeTime(a.createdAt, t)}
                              </time>
                            )}
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-muted-foreground sm:line-clamp-1">{a.content}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </CollapsibleList>
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts */}
      <div className="mt-6 sm:mt-8">
        <h2 className="mb-4 text-xl font-bold">{t("dashboard.analytics")}</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <VotesOverTimeChart data={chartData.votesOverTime} />
          <TopProposalsChart data={chartData.topProposals} />
          <ActivityHeatmapChart data={chartData.activityHeatmap} />
        </div>
      </div>
    </div>
  );
}
