import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/db";
import { comments, projects, proposals, votes, users, tags, projectTags } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, canManageResource } from "@/lib/rbac";
import { canActOnProject } from "@/lib/project-members";
import type { Role } from "@/lib/rbac";
import { eq, asc, count, countDistinct } from "drizzle-orm";
import Link from "next/link";
import { DeleteProjectButton } from "./delete-button";
import { EditProjectDialog } from "@/components/edit-project-dialog";
import { ShareProjectDialog } from "@/components/share-project-dialog";
import { ProposalForm } from "@/components/proposal-form";
import { ProposalList } from "@/components/proposal-list";
import { ExportButtons } from "@/components/export-buttons";
import { getProjectProposals, PROPOSALS_PAGE_SIZE, isValidSort } from "./queries";
import type { ProposalSort } from "./queries";
import { ProposalSortSelector } from "@/components/proposal-sort-selector";
import { Pagination } from "@/components/pagination";
import { ProjectComments } from "@/components/project-comments";
import { getTranslations } from "@/lib/i18n-server";
import { RegenerateSummaryButton } from "@/components/regenerate-summary-button";
import { SuggestProposalsButton } from "@/components/suggest-proposals";
import { ArchiveBanner } from "@/components/archive-banner";
import { TagFilter } from "@/components/tag-filter";
import { ClientOnly } from "@/components/client-only";
import { isProjectOpen } from "@/lib/status-utils";
import { ProjectOverview } from "@/components/project-overview";
import { ProjectTools } from "@/components/project-tools";
import { ProjectLivePanel } from "@/components/project-live-panel";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; sort?: string; tag?: string }>;
}

/**
 * Generate dynamic metadata for the project page (SEO + Open Graph)
 */
export async function generateMetadata({
  params,
}: ProjectPageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await db
    .select({ title: projects.title, description: projects.description, updatedAt: projects.updatedAt })
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (project.length === 0) {
    return { title: "Project Not Found" };
  }

  const desc = project[0].description
    ? project[0].description.substring(0, 160)
    : "View proposals, vote, and discuss ideas";

  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  const cacheBust = project[0].updatedAt
    ? Math.floor(new Date(project[0].updatedAt).getTime() / 1000)
    : Date.now();
  const ogImage = `${appUrl}/api/og/project/${id}?v=${cacheBust}`;

  return {
    title: project[0].title,
    description: desc,
    openGraph: {
      title: project[0].title,
      description: desc,
      type: "article",
      images: [{ url: ogImage, width: 1200, height: 630, alt: project[0].title }],
    },
    twitter: {
      card: "summary_large_image",
      title: project[0].title,
      description: desc,
      images: [ogImage],
    },
  };
}

/**
 * Individual project page with proposals, voting, and discussions.
 * RBAC-aware: shows controls based on user permissions.
 */
export default async function ProjectPage({ params, searchParams }: ProjectPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { id } = await params;
  const { t, locale } = await getTranslations();
  const role = user.role as Role;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value ?? "";

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (project.length === 0) {
    notFound();
  }

  const projectData = project[0];
  const isArchived = projectData.status === "archived";
  const readOnly = !isProjectOpen(projectData);
  const canEdit = !isArchived && canManageResource(role, projectData.userId, user.id);
  const canCreateProposal = !readOnly && (await canActOnProject(role, user.id, projectData.id, "proposal:create"));
  const isAdmin = hasPermission(role, "project:manage_all");

  const sp = await searchParams;
  const proposalPage = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const proposalSort: ProposalSort = isValidSort(sp.sort || "") ? sp.sort as ProposalSort : "votes";
  const filterTag = sp.tag || undefined;
  const proposalOffset = (proposalPage - 1) * PROPOSALS_PAGE_SIZE;
  const [{ proposals: proposalsWithStats, total: proposalTotal }, commentRows, allTags, projectTagRows, votingStats] =
    await Promise.all([
      getProjectProposals(id, user.id, PROPOSALS_PAGE_SIZE, proposalOffset, proposalSort, filterTag),
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
        .where(eq(comments.projectId, id))
        .orderBy(comments.createdAt),
      db.select({ id: tags.id, name: tags.name }).from(tags).orderBy(asc(tags.name)),
      db.select({ tagId: projectTags.tagId }).from(projectTags).where(eq(projectTags.projectId, id)),
      db.select({ votes: count(), voters: countDistinct(votes.userId) }).from(votes)
        .innerJoin(proposals, eq(votes.proposalId, proposals.id)).where(eq(proposals.projectId, id)),
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
  const currentTagNames = allTags.filter((t) => currentTagIds.includes(t.id));
  const proposalTotalPages = Math.ceil(proposalTotal / PROPOSALS_PAGE_SIZE);

  return (
    <div className="mx-auto max-w-4xl py-4 sm:py-6">
      <div className="mb-3">
        <Link href="/projects" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
          &larr; {t("projects.back")}
        </Link>
      </div>

      {isArchived && <ArchiveBanner projectId={id} isAdmin={isAdmin} />}

      <ProjectOverview
        project={projectData}
        stats={votingStats[0] ?? { votes: 0, voters: 0 }}
        tags={currentTagNames}
        locale={locale}
        t={t}
        tools={
          <div className="flex items-center">
            {canCreateProposal && (
              <ProposalForm compact
                    projectId={id}
                    projectTitle={projectData.title}
                    projectDescription={projectData.description || ""}
                    existingProposals={proposalsWithStats.map((p) => ({
                      id: p.id,
                      title: p.title,
                      description: p.description ?? undefined,
                      summary: p.summary ?? undefined,
                    }))}
                    availableTags={allTags}
              />
            )}
          <ProjectTools>
            <ProposalSortSelector currentSort={proposalSort} />
            {allTags.length > 0 && <TagFilter tags={allTags} activeTagId={filterTag} />}
            <ExportButtons projectId={id} />
            {canCreateProposal && (
                  <SuggestProposalsButton
                    projectId={id}
                    projectTitle={projectData.title}
                    projectDescription={projectData.description || ""}
                    existingProposals={proposalsWithStats.map((p) => ({
                      title: p.title,
                      description: p.description ?? undefined,
                      summary: p.summary ?? undefined,
                    }))}
                  />
            )}
            {canEdit && (
              <>
                <ShareProjectDialog projectId={id} initialToken={projectData.shareToken ?? null} />
                <EditProjectDialog projectId={id} title={projectData.title}
                  description={projectData.description} deadline={projectData.deadline}
                  status={projectData.status} availableTags={allTags} currentTagIds={currentTagIds} />
                <RegenerateSummaryButton projectId={id} />
                <DeleteProjectButton projectId={id} />
              </>
            )}
          </ProjectTools>
          </div>
        }
      />
          <section className={`mt-4 ${readOnly ? "opacity-65" : ""}`} aria-label={t("proposals.count", { count: proposalTotal })}>
            <ClientOnly fallback={
              <div className="space-y-2">
                {proposalsWithStats.map((p) => (
                  <div key={p.id} className="h-20 animate-pulse rounded-lg border bg-muted/30" />
                ))}
              </div>
            }>
              <ProposalList
                proposals={proposalsWithStats}
                projectId={id}
                currentUserId={user.id}
                isAdmin={isAdmin}
                readOnly={readOnly}
                sort={proposalSort}
              />
            </ClientOnly>
            {proposalTotalPages > 1 && (
              <div className={`mt-4 ${readOnly ? "opacity-65" : ""}`}>
                <Pagination currentPage={proposalPage} totalPages={proposalTotalPages} />
              </div>
            )}
          </section>

          <details className="mt-6 rounded-lg border p-3">
            <summary className="cursor-pointer text-sm text-muted-foreground">{t("live.activityFeed")}</summary>
            <ClientOnly><ProjectLivePanel projectId={id} sessionToken={sessionToken} /></ClientOnly>
          </details>
          <ClientOnly>
            <ProjectComments projectId={id} comments={projectComments} currentUserId={user.id} readOnly={readOnly} />
          </ClientOnly>
    </div>
  );
}
