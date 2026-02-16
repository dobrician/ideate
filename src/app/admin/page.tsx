import { redirect } from "next/navigation";
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
import { Users, FolderOpen, Lightbulb, ThumbsUp } from "lucide-react";
import { UserRoleManager } from "./user-role-manager";
import { StatCard } from "@/components/stat-card";
import { getTranslations } from "@/lib/i18n-server";

/**
 * Admin panel — user management, system stats, audit log
 */
export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  if (!hasPermission(user.role as Role, "user:manage")) {
    redirect("/dashboard");
  }
  const { t } = await getTranslations();

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
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("admin.title")}</h1>
        <p className="text-muted-foreground">
          {t("admin.subtitle")}
        </p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                    className="flex items-center gap-3 text-sm"
                  >
                    <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs font-medium">
                      {entry.action}
                    </span>
                    <span className="font-medium">
                      {entry.userEmail || "System"}
                    </span>
                    <span className="text-muted-foreground">
                      {entry.entity}
                      {entry.entityId ? ` #${entry.entityId.substring(0, 8)}` : ""}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {entry.createdAt
                        ? new Date(entry.createdAt).toLocaleString()
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

