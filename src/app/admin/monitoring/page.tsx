import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldX } from "lucide-react";
import { getTranslations } from "@/lib/i18n-server";
import { getPerfStats } from "@/lib/perf-monitor";
import { getCacheStats } from "@/lib/cache";
import { getQueueStats } from "@/lib/queue";
import { MonitoringPanel } from "./monitoring-panel";

export default async function MonitoringPage() {
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

  const [perfStats, cacheStats, queueStats] = await Promise.all([
    getPerfStats(),
    getCacheStats(),
    getQueueStats(),
  ]);

  return (
    <div className="mx-auto max-w-6xl py-4 sm:py-8">
      <div className="mb-5 flex items-center gap-3 sm:mb-8">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin"><ArrowLeft className="mr-1 h-4 w-4" />{t("analytics.backToAdmin")}</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t("monitoring.title")}</h1>
          <p className="text-muted-foreground">{t("monitoring.subtitle")}</p>
        </div>
      </div>

      <MonitoringPanel perfStats={perfStats} cacheStats={cacheStats} queueStats={queueStats} />
    </div>
  );
}
