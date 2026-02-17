import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { users, projects, proposals, votes, comments, auditLogs } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { desc, sql, count } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, FolderOpen, Lightbulb, ThumbsUp, ShieldX } from "lucide-react";
import { UserRoleManager } from "./user-role-manager";
import { StatCard } from "@/components/stat-card";
import { getTranslations } from "@/lib/i18n-server";
import { formatRelativeTime } from "@/lib/utils";

/**
 * Admin panel — user management, system stats, audit log
 */
export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const { t, locale } = await getTranslations();

  if (!hasPermission(user.role as Role, "user:manage")) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <ShieldX className="mb-4 h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">{t("common.accessDenied")}</h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          {t("common.accessDeniedDesc")}
        </p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">{t("common.goToDashboard")}</Link>
        </Button>
      </div>
    );
  }
  // locale used for date formatting via formatDateTime

  const [allUsers, stats, recentAudit] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt)),

    db
      .select({
        userCount: sql<number>`(SELECT COUNT(*) FROM users)`,
        projectCount: sql<number>`(SELECT COUNT(*) FROM projects)`,
        proposalCount: sql<number>`(SELECT COUNT(*) FROM proposals)`,
        voteCount: sql<number>`(SELECT COUNT(*) FROM votes)`,
        commentCount: sql<number>`(SELECT COUNT(*) FROM comments)`,
      })
      .from(sql`(SELECT 1)`),

    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entity: auditLogs.entity,
        entityId: auditLogs.entityId,
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
        userEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, sql`${auditLogs.userId} = ${users.id}`)
      .orderBy(desc(auditLogs.createdAt))
      .limit(20),
  ]);

  const s = stats[0];

  return (
    <div className="mx-auto max-w-6xl py-4 sm:py-8">
      <div className="mb-5 sm:mb-8">
        <h1 className="text-2xl font-bold sm:text-3xl">{t("admin.title")}</h1>
        <p className="text-muted-foreground">
          {t("admin.subtitle")}
        </p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-4 lg:grid-cols-4">
        <StatCard
          title={t("admin.users")}
          value={Number(s?.userCount ?? 0)}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title={t("admin.projects")}
          value={Number(s?.projectCount ?? 0)}
          icon={<FolderOpen className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title={t("admin.proposals")}
          value={Number(s?.proposalCount ?? 0)}
          icon={<Lightbulb className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title={t("admin.votes")}
          value={Number(s?.voteCount ?? 0)}
          icon={<ThumbsUp className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* User Management */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("admin.userManagement")}</CardTitle>
            <CardDescription>
              {t("admin.registeredUsers", { count: allUsers.length })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserRoleManager users={allUsers} currentUserId={user.id} />
          </CardContent>
        </Card>

        {/* Audit Log */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("admin.recentActivity")}</CardTitle>
            <CardDescription>{t("admin.auditEntries")}</CardDescription>
          </CardHeader>
          <CardContent>
            {recentAudit.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("admin.noActivity")}</p>
            ) : (
              <div className="space-y-2">
                {recentAudit.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex min-w-0 items-center gap-2 text-sm sm:gap-3"
                  >
                    <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs font-medium">
                      {entry.action}
                    </span>
                    <span className="min-w-0 truncate font-medium">
                      {entry.userEmail || "System"}
                    </span>
                    <span className="hidden min-w-0 truncate text-muted-foreground sm:inline">
                      {entry.entity}
                      {entry.entityId ? ` #${entry.entityId.substring(0, 8)}` : ""}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {entry.createdAt
                        ? formatRelativeTime(entry.createdAt, locale, t)
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

