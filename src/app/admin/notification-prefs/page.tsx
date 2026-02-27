import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ShieldX,
  Bell,
  Monitor,
  Mail,
  Activity,
  Search,
  Brain,
  Settings,
} from "lucide-react";
import { getTranslations } from "@/lib/i18n-server";
import { getAdminAlertPreferences } from "@/lib/admin-notification-prefs";

const CATEGORY_META = [
  { key: "ci_alerts" as const, icon: "Activity", labelKey: "admin.notifCategoryCi" },
  { key: "search_quality" as const, icon: "Search", labelKey: "admin.notifCategorySearch" },
  { key: "embedding_alerts" as const, icon: "Brain", labelKey: "admin.notifCategoryEmbedding" },
  { key: "system_events" as const, icon: "Settings", labelKey: "admin.notifCategorySystem" },
];

const CHANNEL_META = [
  { key: "in_app" as const, icon: "Monitor", labelKey: "admin.notifChannelInApp" },
  { key: "email" as const, icon: "Mail", labelKey: "admin.notifChannelEmail" },
];

const IconMap = { Activity, Search, Brain, Settings, Monitor, Mail };

export default async function NotificationPrefsPage() {
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

  const preferences = await getAdminAlertPreferences(user.id);

  // Build a lookup: category:channel → enabled
  const prefMap = new Map<string, boolean>();
  for (const pref of preferences) {
    prefMap.set(`${pref.category}:${pref.channel}`, pref.enabled);
  }

  return (
    <div className="mx-auto max-w-4xl py-4 sm:py-8">
      <div className="mb-5 flex items-center gap-3 sm:mb-8">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin">
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t("aiInsights.backToAdmin")}
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl flex items-center gap-2">
            <Bell className="h-6 w-6" />
            {t("admin.notificationPrefs")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("admin.notificationPrefsDesc")}</p>
        </div>
      </div>

      {/* Preferences Grid */}
      <div className="rounded-lg border bg-card">
        {/* Header Row */}
        <div className="grid grid-cols-3 gap-2 p-4 border-b bg-muted/30 text-sm font-semibold">
          <div>Category</div>
          {CHANNEL_META.map((ch) => {
            const Icon = IconMap[ch.icon as keyof typeof IconMap];
            return (
              <div key={ch.key} className="flex items-center gap-2 justify-center">
                <Icon className="h-4 w-4" />
                {t(ch.labelKey)}
              </div>
            );
          })}
        </div>

        {/* Category Rows */}
        {CATEGORY_META.map((cat) => {
          const CatIcon = IconMap[cat.icon as keyof typeof IconMap];
          return (
            <div key={cat.key} className="grid grid-cols-3 gap-2 p-4 border-b last:border-b-0 items-center">
              <div className="flex items-center gap-2">
                <CatIcon className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">{t(cat.labelKey)}</span>
              </div>
              {CHANNEL_META.map((ch) => {
                const enabled = prefMap.get(`${cat.key}:${ch.key}`) ?? true;
                return (
                  <div key={ch.key} className="flex justify-center">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                        enabled
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {enabled ? t("admin.notifEnabled") : t("admin.notifDisabled")}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* API Info */}
      <div className="mt-6 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>
          Preferences can be updated via the API:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            POST /api/admin/notification-prefs
          </code>
        </p>
        <p className="mt-1">
          Body: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            {`{ "category": "ci_alerts", "channel": "email", "enabled": false }`}
          </code>
        </p>
      </div>
    </div>
  );
}
