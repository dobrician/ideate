import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, canManageResource } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { DeleteProjectButton } from "./delete-button";
import { ProposalForm } from "@/components/proposal-form";
import { ProposalList } from "@/components/proposal-list";
import { ExportButtons } from "@/components/export-buttons";
import { DeadlineCountdown } from "@/components/deadline-countdown";
import { getProjectProposals } from "./queries";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
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
export default async function ProjectPage({ params }: ProjectPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { id } = await params;
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

  const proposalsWithStats = await getProjectProposals(id, user.id);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="outline" size="sm">
          <Link href="/projects">&larr; Back to Projects</Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <ExportButtons projectId={id} />
          {canEdit && (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href={`/projects/${id}/edit`}>Edit</Link>
              </Button>
              <DeleteProjectButton projectId={id} />
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              <CardTitle className="text-2xl sm:text-3xl">
                {projectData.title}
              </CardTitle>
              <CardDescription className="mt-2 flex flex-wrap items-center gap-2 sm:gap-4">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    projectData.status === "active"
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : projectData.status === "draft"
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                  }`}
                >
                  {projectData.status}
                </span>
                {projectData.deadline && (
                  <DeadlineCountdown deadline={projectData.deadline} />
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {projectData.summary && (
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-sm italic text-muted-foreground">
                {projectData.summary}
              </p>
            </div>
          )}

          {projectData.description && (
            <div>
              <h2 className="mb-2 text-lg font-semibold">Description</h2>
              <div className="prose dark:prose-invert max-w-none">
                <p className="whitespace-pre-wrap text-muted-foreground">
                  {projectData.description}
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                Created
              </h3>
              <p>
                {projectData.createdAt
                  ? new Date(projectData.createdAt).toLocaleDateString(
                      "en-US",
                      { year: "numeric", month: "long", day: "numeric" }
                    )
                  : "Unknown"}
              </p>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                Last Updated
              </h3>
              <p>
                {projectData.updatedAt
                  ? new Date(projectData.updatedAt).toLocaleDateString(
                      "en-US",
                      { year: "numeric", month: "long", day: "numeric" }
                    )
                  : "Never"}
              </p>
            </div>
          </div>

          <div className="border-t pt-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold">
                Proposals ({proposalsWithStats.length})
              </h2>
              {canCreateProposal && <ProposalForm projectId={id} />}
            </div>
            <ProposalList
              proposals={proposalsWithStats}
              projectId={id}
              currentUserId={user.id}
              isAdmin={isAdmin}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
