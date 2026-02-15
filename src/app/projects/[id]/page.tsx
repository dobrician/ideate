import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { DeleteProjectButton } from "./delete-button";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Individual project page
 * Shows project details and allows editing/deleting
 */
export default async function ProjectPage({ params }: ProjectPageProps) {
  // Require authentication
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { id } = await params;

  // Fetch project
  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (project.length === 0) {
    notFound();
  }

  const projectData = project[0];
  const isOwner = projectData.userId === user.id;
  const isAdmin = user.role === "admin";
  const canEdit = isOwner || isAdmin;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Button asChild variant="outline">
          <Link href="/projects">← Back to Projects</Link>
        </Button>
        {canEdit && (
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/projects/${id}/edit`}>Edit</Link>
            </Button>
            <DeleteProjectButton projectId={id} />
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-3xl">{projectData.title}</CardTitle>
              <CardDescription className="mt-2 flex items-center gap-4">
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
                <span>
                  Deadline:{" "}
                  {projectData.deadline
                    ? new Date(projectData.deadline).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "Not set"}
                </span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
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
              <h3 className="mb-1 text-sm font-medium text-muted-foreground">Created</h3>
              <p>
                {projectData.createdAt
                  ? new Date(projectData.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "Unknown"}
              </p>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-medium text-muted-foreground">Last Updated</h3>
              <p>
                {projectData.updatedAt
                  ? new Date(projectData.updatedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "Never"}
              </p>
            </div>
          </div>

          <div className="border-t pt-6">
            <h2 className="mb-4 text-lg font-semibold">Proposals</h2>
            <p className="text-muted-foreground">
              Proposal management coming soon. Users will be able to submit and vote on ideas here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
