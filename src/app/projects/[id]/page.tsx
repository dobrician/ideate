import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/db";
import { projects, proposals, votes, comments, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, canManageResource } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { eq, desc, sql } from "drizzle-orm";
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

  // Fetch proposals with aggregated vote counts
  const proposalRows = await db
    .select({
      id: proposals.id,
      title: proposals.title,
      description: proposals.description,
      summary: proposals.summary,
      userId: proposals.userId,
      createdAt: proposals.createdAt,
      authorFirstName: users.firstName,
      authorLastName: users.lastName,
      authorEmail: users.email,
      upvotes: sql<number>`COALESCE(SUM(CASE WHEN ${votes.value} = 1 THEN 1 ELSE 0 END), 0)`,
      downvotes: sql<number>`COALESCE(SUM(CASE WHEN ${votes.value} = -1 THEN 1 ELSE 0 END), 0)`,
    })
    .from(proposals)
    .leftJoin(votes, eq(proposals.id, votes.proposalId))
    .leftJoin(users, eq(proposals.userId, users.id))
    .where(eq(proposals.projectId, id))
    .groupBy(proposals.id)
    .orderBy(desc(proposals.createdAt));

  // Fetch current user's votes for highlighting
  const userVoteRows = await db
    .select({ proposalId: votes.proposalId, value: votes.value })
    .from(votes)
    .where(eq(votes.userId, user.id));
  const voteMap = new Map(userVoteRows.map((v) => [v.proposalId, v.value]));

  // Fetch all comments for this project's proposals
  const proposalIds = proposalRows.map((p) => p.id);
  let allComments: {
    id: string;
    proposalId: string;
    parentId: string | null;
    content: string;
    userId: string | null;
    createdAt: Date | null;
    userEmail: string | null;
    userName: string | null;
  }[] = [];

  if (proposalIds.length > 0) {
    allComments = await db
      .select({
        id: comments.id,
        proposalId: comments.proposalId,
        parentId: comments.parentId,
        content: comments.content,
        userId: comments.userId,
        createdAt: comments.createdAt,
        userEmail: users.email,
        userName: users.firstName,
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(
        sql`${comments.proposalId} IN (${sql.join(
          proposalIds.map((pid) => sql`${pid}`),
          sql`, `
        )})`
      )
      .orderBy(comments.createdAt);
  }

  // Group comments by proposal
  const commentsByProposal = new Map<string, typeof allComments>();
  for (const c of allComments) {
    const list = commentsByProposal.get(c.proposalId) || [];
    list.push(c);
    commentsByProposal.set(c.proposalId, list);
  }

  // Build enriched proposal data
  const proposalsWithStats = proposalRows.map((p) => {
    const pComments = commentsByProposal.get(p.id) || [];
    const authorName =
      [p.authorFirstName, p.authorLastName].filter(Boolean).join(" ") ||
      p.authorEmail ||
      "Anonymous";

    return {
      id: p.id,
      title: p.title,
      description: p.description,
      summary: p.summary,
      userId: p.userId,
      createdAt: p.createdAt,
      upvotes: Number(p.upvotes),
      downvotes: Number(p.downvotes),
      userVote: voteMap.get(p.id) ?? null,
      commentCount: pComments.length,
      comments: pComments.map((c) => ({
        id: c.id,
        content: c.content,
        parentId: c.parentId,
        userId: c.userId,
        userEmail: c.userEmail ?? undefined,
        userName: c.userName ?? undefined,
        createdAt: c.createdAt,
      })),
      authorName,
    };
  });

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
