import Link from "next/link";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Pagination } from "@/components/pagination";
import { FolderOpen, Calendar, Clock } from "lucide-react";
import { desc, count } from "drizzle-orm";
import { getTranslations } from "@/lib/i18n-server";
import { statusBadgeClass, statusLabel } from "@/lib/status-utils";

const PAGE_SIZE = 20;

interface ProjectsPageProps {
  searchParams: Promise<{ page?: string }>;
}

/**
 * Projects list page with pagination
 */
export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const { t, locale } = await getTranslations();
  const dateFmt = locale === "ro" ? "ro-RO" : "en-US";

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [allProjects, totalResult] = await Promise.all([
    db
      .select()
      .from(projects)
      .orderBy(desc(projects.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ total: count() }).from(projects),
  ]);

  const total = totalResult[0]?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t("projects.title")}</h1>
          <p className="text-muted-foreground">
            {t("projects.total", { count: total })}
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">{t("projects.createProject")}</Link>
        </Button>
      </div>

      {allProjects.length === 0 && page === 1 ? (
        <Card className="py-12 text-center">
          <CardContent className="flex flex-col items-center gap-4">
            <div className="rounded-full bg-muted p-4">
              <FolderOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold">{t("projects.noProjects")}</p>
              <p className="text-sm text-muted-foreground">
                {t("projects.noProjectsDesc")}
              </p>
            </div>
            <Button asChild>
              <Link href="/projects/new">{t("projects.createFirst")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allProjects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="h-full transition-all duration-200 hover:shadow-lg hover:border-primary/20">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="line-clamp-2 text-base">
                        {project.title}
                      </CardTitle>
                      <Badge className={statusBadgeClass(project.status)}>
                        {statusLabel(project.status, t)}
                      </Badge>
                    </div>
                    {project.description && (
                      <CardDescription className="line-clamp-3">
                        {project.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          {t("projects.deadline")}:{" "}
                          {project.deadline
                            ? new Date(project.deadline).toLocaleDateString(dateFmt)
                            : t("projects.deadlineNotSet")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          {t("projects.created")}:{" "}
                          {project.createdAt
                            ? new Date(project.createdAt).toLocaleDateString(dateFmt)
                            : t("projects.unknown")}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="mt-8">
            <Pagination currentPage={page} totalPages={totalPages} />
          </div>
        </>
      )}
    </div>
  );
}
