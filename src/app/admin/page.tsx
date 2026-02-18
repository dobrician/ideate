import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, FolderOpen, Lightbulb, ThumbsUp, ShieldX } from "lucide-react";
import { UserRoleManager } from "./user-role-manager";
import { AuditLog } from "./audit-log";
import { InvitationPanel } from "./invitation-panel";
import { ProjectManager } from "./project-manager";
import { TagManager } from "./tag-manager";
import { WebhookManager } from "./webhook-manager";
import { TemplateManager } from "./template-manager";
import { RateLimitPanel } from "./rate-limit-panel";
import { TeamManager } from "./team-manager";
import { StatCard } from "@/components/stat-card";
import { getTranslations } from "@/lib/i18n-server";
import { getAdminData } from "./queries";

export default async function AdminPage() {
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

  const { allUsers, stats: s, recentAudit, pendingInvitations, allProjects, allTags, allWebhooks, allTemplates, allTeams } = await getAdminData();

  return (
    <div className="mx-auto max-w-6xl py-4 sm:py-8">
      <div className="mb-5 sm:mb-8">
        <h1 className="text-2xl font-bold sm:text-3xl">{t("admin.title")}</h1>
        <p className="text-muted-foreground">{t("admin.subtitle")}</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-4 lg:grid-cols-4">
        <StatCard title={t("admin.users")} value={Number(s?.userCount ?? 0)} icon={<Users className="h-4 w-4 text-muted-foreground" />} href="#user-management" />
        <StatCard title={t("admin.projects")} value={Number(s?.projectCount ?? 0)} icon={<FolderOpen className="h-4 w-4 text-muted-foreground" />} href="/projects" />
        <StatCard title={t("admin.proposals")} value={Number(s?.proposalCount ?? 0)} icon={<Lightbulb className="h-4 w-4 text-muted-foreground" />} />
        <StatCard title={t("admin.votes")} value={Number(s?.voteCount ?? 0)} icon={<ThumbsUp className="h-4 w-4 text-muted-foreground" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="user-management" className="lg:col-span-2 scroll-mt-20">
          <CardHeader>
            <CardTitle>{t("admin.userManagement")}</CardTitle>
            <CardDescription>{t("admin.registeredUsers", { count: allUsers.length })}</CardDescription>
          </CardHeader>
          <CardContent><UserRoleManager users={allUsers} currentUserId={user.id} /></CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("admin.projectManagement")}</CardTitle>
            <CardDescription>{t("admin.projectCount", { count: allProjects.length })}</CardDescription>
          </CardHeader>
          <CardContent><ProjectManager projects={allProjects} /></CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("tags.management")}</CardTitle>
            <CardDescription>{t("tags.managementDesc")}</CardDescription>
          </CardHeader>
          <CardContent><TagManager initialTags={allTags} /></CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("webhooks.title")}</CardTitle>
            <CardDescription>{t("webhooks.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <WebhookManager initialWebhooks={allWebhooks.map((wh) => ({
              ...wh, events: JSON.parse(wh.events) as string[], secret: wh.secret.slice(0, 8) + "...",
              active: Boolean(wh.active), createdAt: wh.createdAt?.toISOString() ?? null,
            }))} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("templates.title")}</CardTitle>
            <CardDescription>{t("templates.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <TemplateManager initialTemplates={allTemplates.map((tpl) => ({
              ...tpl, defaultTags: tpl.defaultTags ? JSON.parse(tpl.defaultTags) as string[] : [],
            }))} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("admin.invitations")}</CardTitle>
            <CardDescription>{t("admin.invitationsDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <InvitationPanel initialInvitations={pendingInvitations.map((inv) => ({
              ...inv, expiresAt: inv.expiresAt?.toISOString() ?? null, createdAt: inv.createdAt?.toISOString() ?? null,
            }))} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("teams.title")}</CardTitle>
            <CardDescription>{t("teams.description")}</CardDescription>
          </CardHeader>
          <CardContent><TeamManager initialTeams={allTeams} /></CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Rate Limits</CardTitle>
            <CardDescription>Active in-memory rate-limit entries (15-min window)</CardDescription>
          </CardHeader>
          <CardContent><RateLimitPanel /></CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("admin.recentActivity")}</CardTitle>
            <CardDescription>{t("admin.auditEntries")}</CardDescription>
          </CardHeader>
          <CardContent><AuditLog entries={recentAudit} /></CardContent>
        </Card>
      </div>
    </div>
  );
}
