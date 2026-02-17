import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, canManageResource } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { eq } from "drizzle-orm";
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
import { ProposalForm, ProposalFormInline } from "@/components/proposal-form";
import { ProposalList } from "@/components/proposal-list";
import { ExportButtons } from "@/components/export-buttons";
import { DeadlineCountdown } from "@/components/deadline-countdown";
import { getProjectProposals, PROPOSALS_PAGE_SIZE } from "./queries";
import { getProjectComments } from "@/db/queries";
import { Pagination } from "@/components/pagination";
import { ProjectComments } from "@/components/project-comments";
import { getTranslations } from "@/lib/i18n-server";
import { statusBadgeClass, statusLabel } from "@/lib/status-utils";
import { formatDate } from "@/lib/utils";
import { RegenerateSummaryButton } from "@/components/regenerate-summary-button";
import { SuggestProposalsButton } from "@/components/suggest-proposals";
import { MarkdownRenderer } from "@/components/markdown-renderer";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}

/**
 * Generate dynamic metadata for the project page (SEO + Open Graph)
 */
export async function generateMetadata({
  params,
}: ProjectPageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await db
    .select({ title: projects.title, description: projects.description })
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (project.length === 0) {
    return { title: "Project Not Found" };
  }

  const desc = project[0].description
    ? project[0].description.substring(0, 160)
    : "View proposals, vote, and discuss ideas";

  return {
    title: project[0].title,
    description: desc,
    openGraph: {
      title: project[0].title,
      description: desc,
      type: "article",
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

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (project.length === 0) {
    notFound();
  }

  const projectData = project[0];
  const canEdit = canManageResource(role, projectData.userId, user.id);
  const canCreateProposal = hasPermission(role, "proposal:create");
  const isAdmin = hasPermission(role, "project:manage_all");

  const sp = await searchParams;
  const proposalPage = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const proposalOffset = (proposalPage - 1) * PROPOSALS_PAGE_SIZE;
  const [{ proposals: proposalsWithStats, total: proposalTotal }, projectComments] =
    await Promise.all([
      getProjectProposals(id, user.id, PROPOSALS_PAGE_SIZE, proposalOffset),
      getProjectComments(id),
    ]);
  const proposalTotalPages = Math.ceil(proposalTotal / PROPOSALS_PAGE_SIZE);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-4 sm:py-6 lg:max-w-6xl lg:grid lg:grid-cols-[1.6fr_1fr] lg:items-start lg:gap-6">
      <div className="mb-3 lg:col-span-2">
        <Link href="/projects" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
          &larr; {t("projects.back")}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-2xl sm:text-3xl">
                {projectData.title}
              </CardTitle>
              <CardDescription className="mt-2 flex flex-wrap items-center gap-2 sm:gap-4">
                <Badge className={statusBadgeClass(projectData.status)}>
                  {statusLabel(projectData.status, t)}
                </Badge>
                {projectData.deadline && (
                  <DeadlineCountdown deadline={projectData.deadline} />
                )}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <ExportButtons projectId={id} />
              {canEdit && (
                <>
                  <EditProjectDialog
                    projectId={id}
                    title={projectData.title}
                    description={projectData.description}
                    deadline={projectData.deadline}
                    status={projectData.status}
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
            <div className="mb-4 grid grid-cols-[1fr_auto] items-center gap-2">
              <h2 className="text-lg font-semibold">
                {t("proposals.count", { count: proposalTotal })}
              </h2>
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
                  {/* Dialog trigger visible only below lg */}
                  <div className="lg:hidden">
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
                    />
                  </div>
                </div>
              )}
            </div>
            <ProposalList
              proposals={proposalsWithStats}
              projectId={id}
              currentUserId={user.id}
              isAdmin={isAdmin}
            />
            {proposalTotalPages > 1 && (
              <div className="mt-6">
                <Pagination currentPage={proposalPage} totalPages={proposalTotalPages} />
              </div>
            )}
          </div>

          <ProjectComments projectId={id} comments={projectComments} currentUserId={user.id} />
        </CardContent>
      </Card>

      {/* Sticky sidebar with inline proposal form — desktop only */}
      {canCreateProposal && (
        <aside className="hidden lg:block lg:sticky lg:top-24 lg:self-start">
          <ProposalFormInline
            projectId={id}
            projectTitle={projectData.title}
            projectDescription={projectData.description || ""}
            existingProposals={proposalsWithStats.map((p) => ({
              id: p.id,
              title: p.title,
              description: p.description ?? undefined,
              summary: p.summary ?? undefined,
            }))}
          />
        </aside>
      )}
    </div>
  );
}
