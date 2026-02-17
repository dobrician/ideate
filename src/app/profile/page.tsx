import { redirect } from "next/navigation";
import { db } from "@/db";
import { projects, proposals } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { FolderOpen, Lightbulb } from "lucide-react";
import { ProfileForm } from "./profile-form";
import { ChangePasswordForm } from "./change-password-form";
import { getTranslations } from "@/lib/i18n-server";
import { statusBadgeClass, statusLabel } from "@/lib/status-utils";

/**
 * User profile page showing user info, their projects and proposals
 */
export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { t, locale } = await getTranslations();
  const dateFmt = locale === "ro" ? "ro-RO" : "en-US";

  // Fetch user's projects
  const userProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, user.id))
    .orderBy(desc(projects.createdAt))
    .limit(10);

  // Fetch user's proposals
  const userProposals = await db
    .select({
      id: proposals.id,
      title: proposals.title,
      projectId: proposals.projectId,
      createdAt: proposals.createdAt,
    })
    .from(proposals)
    .where(eq(proposals.userId, user.id))
    .orderBy(desc(proposals.createdAt))
    .limit(10);

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(dateFmt, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : t("projects.unknown");

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t("profile.title")}</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("profile.account")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("profile.email")}</p>
                <p>{user.email}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("profile.role")}</p>
                <p className="capitalize">{user.role}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("profile.memberSince")}</p>
                <p>{memberSince}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("profile.displayName")}</p>
                <p>{displayName}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <ProfileForm
          firstName={user.firstName ?? ""}
          lastName={user.lastName ?? ""}
        />

        {user.passwordHash && <ChangePasswordForm />}

        <Card>
          <CardHeader>
            <CardTitle>{t("profile.yourProjects", { count: userProjects.length })}</CardTitle>
          </CardHeader>
          <CardContent>
            {userProjects.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div className="rounded-full bg-muted p-3">
                  <FolderOpen className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">{t("profile.noProjects")}</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {userProjects.map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50">
                    <Link
                      href={`/projects/${p.id}`}
                      className="truncate text-sm font-medium text-primary hover:underline"
                    >
                      {p.title}
                    </Link>
                    <Badge className={`shrink-0 ${statusBadgeClass(p.status)}`}>
                      {statusLabel(p.status, t)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("profile.yourProposals", { count: userProposals.length })}</CardTitle>
          </CardHeader>
          <CardContent>
            {userProposals.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div className="rounded-full bg-muted p-3">
                  <Lightbulb className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">{t("profile.noProposals")}</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {userProposals.map((p) => (
                  <li key={p.id} className="rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50">
                    <Link
                      href={`/projects/${p.projectId}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {p.title}
                    </Link>
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
