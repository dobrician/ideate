import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, ShieldX, Brain, AlertTriangle, Clock,
  Map, Database, CheckCircle2, XCircle,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { getTranslations } from "@/lib/i18n-server";
import { getAiInsightsData } from "./queries";

export default async function AiInsightsPage() {
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

  const data = await getAiInsightsData();
  const { jobStats, deadlineHealth, embeddingCount, recentJobs } = data;

  const routingAccuracy = jobStats.routing.total > 0
    ? Math.round((jobStats.routing.completed / jobStats.routing.total) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-6xl py-4 sm:py-8">
      <div className="mb-5 flex items-center gap-3 sm:mb-8">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin"><ArrowLeft className="mr-1 h-4 w-4" />{t("aiInsights.backToAdmin")}</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t("aiInsights.title")}</h1>
          <p className="text-muted-foreground">{t("aiInsights.subtitle")}</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-4 lg:grid-cols-4">
        <StatCard
          title={t("aiInsights.routingAccuracy")}
          value={routingAccuracy}
          icon={<Brain className="h-4 w-4 text-muted-foreground" />}
          description={`${jobStats.routing.completed}/${jobStats.routing.total} jobs`}
        />
        <StatCard
          title={t("aiInsights.conflictsDetected")}
          value={jobStats.conflicts.completed}
          icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
          description={`${jobStats.conflicts.failed} failed`}
        />
        <StatCard
          title={t("aiInsights.deadlinePredictions")}
          value={jobStats.deadlines.completed}
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          description={`${deadlineHealth.atRisk} at risk, ${deadlineHealth.overdue} overdue`}
        />
        <StatCard
          title={t("aiInsights.roadmapsGenerated")}
          value={jobStats.roadmaps.completed}
          icon={<Map className="h-4 w-4 text-muted-foreground" />}
          description={`${embeddingCount} embeddings stored`}
        />
      </div>

      {/* Deadline Health Overview */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Deadline Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  {t("deadlines.health.onTrack")}
                </span>
                <span className="font-mono font-bold">{deadlineHealth.onTrack}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  {t("deadlines.health.atRisk")}
                </span>
                <span className="font-mono font-bold">{deadlineHealth.atRisk}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  {t("deadlines.health.overdue")}
                </span>
                <span className="font-mono font-bold">{deadlineHealth.overdue}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              AI Job Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(["routing", "conflicts", "deadlines", "roadmaps", "embeddings"] as const).map((key) => {
                const stat = jobStats[key];
                return (
                  <div key={key} className="flex items-center justify-between">
                    <span className="capitalize">{key}</span>
                    <span className="font-mono text-sm">
                      {stat.completed}/{stat.total}
                      {stat.failed > 0 && (
                        <span className="ml-1 text-red-500">({stat.failed} failed)</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent AI Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>{t("aiInsights.recentJobs")}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentJobs.length === 0 ? (
            <p className="text-muted-foreground">{t("aiInsights.noJobs")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">{t("aiInsights.jobType")}</th>
                    <th className="pb-2 font-medium">{t("aiInsights.jobStatus")}</th>
                    <th className="pb-2 font-medium">{t("aiInsights.jobCreated")}</th>
                    <th className="pb-2 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.map((job) => (
                    <tr key={job.id} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs">{job.type}</td>
                      <td className="py-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          job.status === "completed" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                          job.status === "failed" || job.status === "dead" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" :
                          job.status === "processing" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" :
                          "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                        }`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {job.createdAt ? new Date(job.createdAt instanceof Date ? job.createdAt : Number(job.createdAt) * 1000).toLocaleString() : "—"}
                      </td>
                      <td className="max-w-[200px] truncate py-2 text-xs text-red-500">
                        {job.lastError ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
