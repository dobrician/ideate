import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { ShieldX, ArrowLeft, Shield, ShieldCheck, ShieldOff, FileKey } from "lucide-react";
import { getTranslations } from "@/lib/i18n-server";
import { getPermissionRules, getResourceAclsList, getPermissionRuleStats, getUsersForSelect } from "./queries";
import { PermissionRuleManager } from "./permission-rule-manager";
import { StatCard } from "@/components/stat-card";

export default async function PermissionsPage() {
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

  const [rules, acls, stats, allUsers] = await Promise.all([
    getPermissionRules(),
    getResourceAclsList(),
    getPermissionRuleStats(),
    getUsersForSelect(),
  ]);

  return (
    <div className="mx-auto max-w-6xl py-4 sm:py-8">
      <div className="mb-5 flex items-center justify-between sm:mb-8">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <h1 className="text-2xl font-bold sm:text-3xl">{t("permissions.title")}</h1>
          </div>
          <p className="text-muted-foreground">{t("permissions.description")}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/permissions/test">{t("permissions.testTool")}</Link>
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard title={t("permissions.totalRules")} value={stats.totalRules} icon={<Shield className="h-4 w-4 text-muted-foreground" />} />
        <StatCard title={t("permissions.activeRules")} value={stats.activeRules} icon={<ShieldCheck className="h-4 w-4 text-muted-foreground" />} />
        <StatCard title={t("permissions.totalAcls")} value={stats.totalAcls} icon={<FileKey className="h-4 w-4 text-muted-foreground" />} />
        <StatCard title={t("permissions.denyRules")} value={stats.denyRules} icon={<ShieldOff className="h-4 w-4 text-muted-foreground" />} />
      </div>

      <PermissionRuleManager
        rules={JSON.parse(JSON.stringify(rules))}
        acls={JSON.parse(JSON.stringify(acls))}
        users={allUsers}
      />
    </div>
  );
}
