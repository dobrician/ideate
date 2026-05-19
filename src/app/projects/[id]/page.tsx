import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/db";
import { comments, projects, users, tags, projectTags } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, canManageResource } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { eq, asc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { DeleteProjectButton } from "./delete-button";
import { EditProjectDialog } from "@/components/edit-project-dialog";
import { ShareProjectDialog } from "@/components/share-project-dialog";
import { ProposalForm } from "@/components/proposal-form";
import { ProposalList } from "@/components/proposal-list";
import { ExportButtons } from "@/components/export-buttons";
import { DeadlineCountdown } from "@/components/deadline-countdown";
import { getProjectProposals, PROPOSALS_PAGE_SIZE, isValidSort } from "./queries";
import type { ProposalSort } from "./queries";
import { ProposalSortSelector } from "@/components/proposal-sort-selector";
import { Pagination } from "@/components/pagination";
import { ProjectComments } from "@/components/project-comments";
import { getTranslations } from "@/lib/i18n-server";
import { statusBadgeClass, statusLabel } from "@/lib/status-utils";
import { formatDate } from "@/lib/utils";
import { RegenerateSummaryButton } from "@/components/regenerate-summary-button";
import { SuggestProposalsButton } from "@/components/suggest-proposals";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { ArchiveBanner } from "@/components/archive-banner";
import { TagFilter } from "@/components/tag-filter";
import { ClientOnly } from "@/components/client-only";
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
  const canEdit = !isArchived && canManageResource(role, projectData.userId, user.id);
  const canCreateProposal = !isArchived && hasPermission(role, "proposal:create");
  const isAdmin = hasPermission(role, "project:manage_all");

  const sp = await searchParams;
  const proposalPage = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const proposalSort: ProposalSort = isValidSort(sp.sort || "") ? sp.sort as ProposalSort : "votes";
  const filterTag = sp.tag || undefined;
  const proposalOffset = (proposalPage - 1) * PROPOSALS_PAGE_SIZE;
  const [{ proposals: proposalsWithStats, total: proposalTotal }, commentRows, allTags, projectTagRows] =
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

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <CardTitle className="break-words text-2xl sm:text-3xl">
                {projectData.title}
              </CardTitle>
              <CardDescription className="mt-2 flex flex-wrap items-center gap-2 sm:gap-4">
                <Badge className={statusBadgeClass(projectData.status)}>
                  {statusLabel(projectData.status, t)}
                </Badge>
                {projectData.deadline && (
                  <DeadlineCountdown deadline={projectData.deadline} />
                )}
                {currentTagNames.map((tag) => (
                  <Badge key={tag.id} variant="secondary">{tag.name}</Badge>
                ))}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <ExportButtons projectId={id} />
              {canEdit && (
                <>
                  <ShareProjectDialog
                    projectId={id}
                    initialToken={projectData.shareToken ?? null}
                  />
                  <EditProjectDialog
                    projectId={id}
                    title={projectData.title}
                    description={projectData.description}
                    deadline={projectData.deadline}
                    status={projectData.status}
                    availableTags={allTags}
                    currentTagIds={currentTagIds}
                  />
                  <DeleteProjectButton projectId={id} />
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {projectData.summary && (
            <div className="rounded-md bg-muted/50 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm italic text-muted-foreground">
                  {projectData.summary}
                </p>
                {canEdit && <RegenerateSummaryButton projectId={id} />}
              </div>
            </div>
          )}

          {projectData.description && (
            <div>
              <h2 className="mb-2 text-lg font-semibold">{t("projects.description")}</h2>
              <MarkdownRenderer content={projectData.description} className="text-muted-foreground" />
            </div>
          )}

          <ClientOnly>
            <ProjectLivePanel projectId={id} sessionToken={sessionToken} />
          </ClientOnly>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                {t("projects.created")}
              </h3>
              <p>
                {projectData.createdAt
                  ? formatDate(projectData.createdAt, locale)
                  : t("projects.unknown")}
              </p>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                {t("projects.lastUpdated")}
              </h3>
              <p>
                {projectData.updatedAt
                  ? formatDate(projectData.updatedAt, locale)
                  : t("projects.never")}
              </p>
            </div>
          </div>

          <div className="border-t pt-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">
                {t("proposals.count", { count: proposalTotal })}
              </h2>
              <ProposalSortSelector currentSort={proposalSort} />
              {allTags.length > 0 && <TagFilter tags={allTags} activeTagId={filterTag} />}
              <div className="flex-1" />
              {canCreateProposal && (
                <div className="flex gap-2">
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
                  <ProposalForm
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
                </div>
              )}
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
                projectId={id}
                currentUserId={user.id}
                isAdmin={isAdmin}
              />
            </ClientOnly>
            {proposalTotalPages > 1 && (
              <div className="mt-6">
                <Pagination currentPage={proposalPage} totalPages={proposalTotalPages} />
              </div>
            )}
          </div>

          <ClientOnly>
            <ProjectComments projectId={id} comments={projectComments} currentUserId={user.id} />
          </ClientOnly>
        </CardContent>
      </Card>
    </div>
  );
}
