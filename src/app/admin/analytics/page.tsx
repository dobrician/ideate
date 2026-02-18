import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, FolderOpen, Lightbulb, ThumbsUp, MessageSquare, ArrowLeft, TrendingUp, ShieldX } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { getTranslations } from "@/lib/i18n-server";
import { getAnalyticsData } from "./queries";
import {
  ProposalTrendChart, VoteTrendChart, UserGrowthChart,
  ProjectHealthChart, EngagementByDayChart, ActivityTrendChart,
} from "./charts";

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const { t } = await getTranslations();

  if (!hasPermission(user.role as Role, "user:manage")) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <ShieldX className="mb-4 h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">{t("common.accessDenied")}</h1>
        <p className="mt-2 max-w-md text-muted-foreground">{t("common.accessDeniedDesc")}</p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">{t("common.goToDashboard")}</Link>
        </Button>
      </div>
    );
  }

  const data = await getAnalyticsData();
  const s = data.totals;

  return (
    <div className="mx-auto max-w-6xl py-4 sm:py-8">
      <div className="mb-5 flex items-center gap-3 sm:mb-8">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin"><ArrowLeft className="mr-1 h-4 w-4" />{t("analytics.backToAdmin")}</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t("analytics.title")}</h1>
          <p className="text-muted-foreground">{t("analytics.subtitle")}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-4 lg:grid-cols-4">
        <StatCard title={t("admin.users")} value={Number(s?.users ?? 0)}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          description={t("analytics.new30d", { count: Number(s?.newUsers30d ?? 0) })} />
        <StatCard title={t("analytics.activeProjects")} value={Number(s?.activeProjects ?? 0)}
          icon={<FolderOpen className="h-4 w-4 text-muted-foreground" />}
          description={t("analytics.ofTotal", { total: Number(s?.projects ?? 0) })} />
        <StatCard title={t("admin.proposals")} value={Number(s?.proposals ?? 0)}
          icon={<Lightbulb className="h-4 w-4 text-muted-foreground" />}
          description={t("analytics.new30d", { count: Number(s?.newProposals30d ?? 0) })} />
        <StatCard title={t("admin.votes")} value={Number(s?.votes ?? 0)}
          icon={<ThumbsUp className="h-4 w-4 text-muted-foreground" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ProposalTrendChart data={data.proposalTrend} />
        <VoteTrendChart data={data.voteTrend} />
        <UserGrowthChart data={data.userGrowth} />
        <ActivityTrendChart data={data.activityTrend} />
        <ProjectHealthChart data={data.projectHealth} />
        <EngagementByDayChart data={data.engagementByDay} />
      </div>
    </div>
  );
}
