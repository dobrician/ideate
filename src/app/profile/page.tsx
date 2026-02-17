import { redirect } from "next/navigation";
import { db } from "@/db";
import { projects, proposals } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { getTranslations } from "@/lib/i18n-server";
import { formatDate } from "@/lib/utils";
import { ProfileTabs } from "./profile-tabs";

/**
 * User profile page with tabbed sections: Account, Security, Projects, Proposals
 */
export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { t, locale } = await getTranslations();

  // Fetch user's projects and proposals in parallel
  const [userProjects, userProposals] = await Promise.all([
    db
      .select({ id: projects.id, title: projects.title, status: projects.status })
      .from(projects)
      .where(eq(projects.userId, user.id))
      .orderBy(desc(projects.createdAt))
      .limit(20),
    db
      .select({
        id: proposals.id,
        title: proposals.title,
        projectId: proposals.projectId,
      })
      .from(proposals)
      .where(eq(proposals.userId, user.id))
      .orderBy(desc(proposals.createdAt))
      .limit(20),
  ]);

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const memberSince = user.createdAt
    ? formatDate(user.createdAt, locale)
    : t("projects.unknown");

  return (
    <div className="mx-auto max-w-3xl py-4 sm:py-8">
      <h1 className="mb-4 text-2xl font-bold sm:mb-6">{t("profile.title")}</h1>

      <ProfileTabs
        user={{
          email: user.email,
          role: user.role,
          memberSince,
          displayName,
          firstName: user.firstName ?? "",
          lastName: user.lastName ?? "",
          hasPassword: !!user.passwordHash,
        }}
        projects={userProjects}
        proposals={userProposals}
      />
    </div>
  );
}
