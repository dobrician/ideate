import { redirect } from "next/navigation";
import { db } from "@/db";
import { notificationPreferences } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { getTranslations } from "@/lib/i18n-server";
import { ProfileForm } from "./profile-form";
import { NotificationSettings } from "./notification-settings";

/** Show account preferences without duplicate project lists or activity reporting. */
export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const { t } = await getTranslations();
  const preferences = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, user.id)).limit(1);
  const prefs = preferences[0] ?? {
    emailNewProposal: true, emailVoteOnMine: true,
    emailCommentReply: true, emailWeeklyDigest: false,
  };
  return (
    <div className="mx-auto max-w-xl space-y-5 py-4 sm:py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("profile.account")}</h1>
        <p className="break-all text-sm text-muted-foreground">{user.email}</p>
      </header>
      <ProfileForm firstName={user.firstName ?? ""} lastName={user.lastName ?? ""} />
      <p className="text-sm text-muted-foreground">{t("profile.ssoIdentity")}</p>
      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer text-sm font-medium">{t("notifications.title")}</summary>
        <div className="mt-4">
          <NotificationSettings prefs={{
            emailNewProposal: Boolean(prefs.emailNewProposal),
            emailVoteOnMine: Boolean(prefs.emailVoteOnMine),
            emailCommentReply: Boolean(prefs.emailCommentReply),
            emailWeeklyDigest: Boolean(prefs.emailWeeklyDigest),
          }} />
        </div>
      </details>
    </div>
  );
}
