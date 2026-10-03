import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/db";
import { comments, projects, proposals, votes, users, tags, projectTags } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { joinProjectAsMember } from "@/lib/project-members";
import { eq, asc, count, countDistinct } from "drizzle-orm";
import { ProjectOverview } from "@/components/project-overview";
import Link from "next/link";
import { ProposalList } from "@/components/proposal-list";
import { getProjectProposals, PROPOSALS_PAGE_SIZE, isValidSort } from "../../projects/[id]/queries";
import type { ProposalSort } from "../../projects/[id]/queries";
import { ProposalSortSelector } from "@/components/proposal-sort-selector";
import { Pagination } from "@/components/pagination";
import { ProjectComments } from "@/components/project-comments";
import { getTranslations } from "@/lib/i18n-server";
import { ArchiveBanner } from "@/components/archive-banner";
import { ClientOnly } from "@/components/client-only";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";

interface SharedProjectPageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}

export async function generateMetadata({
  params,
}: SharedProjectPageProps): Promise<Metadata> {
  const { token } = await params;
  const rows = await db
    .select({ id: projects.id, title: projects.title, description: projects.description, updatedAt: projects.updatedAt })
    .from(projects)
    .where(eq(projects.shareToken, token))
    .limit(1);

  if (rows.length === 0) {
    return { title: "Project Not Found", robots: { index: false, follow: false } };
  }

  const desc = rows[0].description
    ? rows[0].description.substring(0, 160)
    : "View this shared project";

  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  const cacheBust = rows[0].updatedAt
    ? Math.floor(new Date(rows[0].updatedAt).getTime() / 1000)
    : Date.now();
  const ogImage = `${appUrl}/api/og/project/${rows[0].id}?v=${cacheBust}`;

  return {
    title: rows[0].title,
    description: desc,
    robots: { index: false, follow: false },
    openGraph: {
      title: rows[0].title,
      description: desc,
      type: "article",
      images: [{ url: ogImage, width: 1200, height: 630, alt: rows[0].title }],
    },
    twitter: {
      card: "summary_large_image",
      title: rows[0].title,
      description: desc,
      images: [ogImage],
    },
  };
}

/**
 * Public read-only project view, accessible via share token.
 * Guests can view; voting and commenting redirect to login.
 */
export default async function SharedProjectPage({ params, searchParams }: SharedProjectPageProps) {
  const { token } = await params;
  const guestRedirect = `/p/${token}`;

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.shareToken, token))
    .limit(1);

  if (project.length === 0) {
    notFound();
  }

  const projectData = project[0];
  const user = await getCurrentUser();

  // A logged-in visitor following a share link gains persistent membership of
  // the project (Sprint 73). They're then bounced to the canonical project
  // page, where every contribution UI is already wired up. Guests stay on the
  // public read-only view below.
  if (user) {
    await joinProjectAsMember(projectData.id, user.id, "share_link");
    redirect(`/projects/${projectData.id}`);
  }

  const { t, locale } = await getTranslations();
  const isArchived = projectData.status === "archived";

  const sp = await searchParams;
  const proposalPage = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const proposalSort: ProposalSort = isValidSort(sp.sort || "") ? (sp.sort as ProposalSort) : "votes";
  const proposalOffset = (proposalPage - 1) * PROPOSALS_PAGE_SIZE;

  const [{ proposals: proposalsWithStats, total: proposalTotal }, commentRows, projectTagRows, allTagRows, votingStats] =
    await Promise.all([
      getProjectProposals(projectData.id, null, PROPOSALS_PAGE_SIZE, proposalOffset, proposalSort),
      db
        .select({
          id: comments.id,
          content: comments.content,
          parentId: comments.parentId,
          userId: comments.userId,
          createdAt: comments.createdAt,
          userEmail: users.email,
          userName: users.firstName,
          avatarUrl: users.avatarUrl,
        })
        .from(comments)
        .leftJoin(users, eq(comments.userId, users.id))
        .where(eq(comments.projectId, projectData.id))
        .orderBy(comments.createdAt),
      db.select({ tagId: projectTags.tagId }).from(projectTags).where(eq(projectTags.projectId, projectData.id)),
      db.select({ id: tags.id, name: tags.name }).from(tags).orderBy(asc(tags.name)),
      db.select({ votes: count(), voters: countDistinct(votes.userId) }).from(votes)
        .innerJoin(proposals, eq(votes.proposalId, proposals.id)).where(eq(proposals.projectId, projectData.id)),
    ]);

  const projectComments = commentRows.map((r) => ({
    id: r.id,
    content: r.content,
    parentId: r.parentId,
    userId: r.userId,
    userEmail: r.userEmail ?? undefined,
    userName: r.userName ?? undefined,
    avatarUrl: r.avatarUrl ?? undefined,
    createdAt: r.createdAt,
  }));
  const currentTagIds = projectTagRows.map((r) => r.tagId);
  const currentTagNames = allTagRows.filter((tg) => currentTagIds.includes(tg.id));
  const proposalTotalPages = Math.ceil(proposalTotal / PROPOSALS_PAGE_SIZE);

  return (
    <div className="mx-auto max-w-4xl py-4 sm:py-6">
      {!user && (
        <div className="mb-3 flex items-center justify-between rounded-md border border-dashed bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">{t("project.share.guestBannerPrompt")}</span>
          <Button asChild size="sm" variant="secondary">
            <Link href={`/auth/login?redirect=${encodeURIComponent(guestRedirect)}`}>
              <LogIn className="mr-1 h-3 w-3" />
              {t("project.share.signIn")}
            </Link>
          </Button>
        </div>
      )}

      {isArchived && <ArchiveBanner projectId={projectData.id} isAdmin={false} />}

      <ProjectOverview project={projectData} stats={votingStats[0] ?? { votes: 0, voters: 0 }}
        tags={currentTagNames} locale={locale} t={t} tools={null} />
          <div className="mt-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">
                {t("proposals.count", { count: proposalTotal })}
              </h2>
              <ProposalSortSelector currentSort={proposalSort} />
            </div>
            <ClientOnly fallback={
              <div className="space-y-2">
                {proposalsWithStats.map((p) => (
                  <div key={p.id} className="h-20 animate-pulse rounded-lg border bg-muted/30" />
                ))}
              </div>
            }>
              <ProposalList
                proposals={proposalsWithStats}
                projectId={projectData.id}
                currentUserId=""
                isAdmin={false}
                guestRedirect={guestRedirect}
                sort={proposalSort}
              />
            </ClientOnly>
            {proposalTotalPages > 1 && (
              <div className="mt-6">
                <Pagination currentPage={proposalPage} totalPages={proposalTotalPages} />
              </div>
            )}
          </div>

          <ClientOnly>
            <ProjectComments
              projectId={projectData.id}
              comments={projectComments}
              currentUserId={undefined}
              guestRedirect={guestRedirect}
            />
          </ClientOnly>
    </div>
  );
}
