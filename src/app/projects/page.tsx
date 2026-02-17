import Link from "next/link";
import { db } from "@/db";
import { projects, tags, projectTags } from "@/db/schema";
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
import { ProjectFilters } from "@/components/project-filters";
import { FolderOpen, Calendar, Clock } from "lucide-react";
import { desc, asc, count, like, eq, and, sql, inArray, type SQL } from "drizzle-orm";
import { getTranslations } from "@/lib/i18n-server";
import { statusBadgeClass, statusLabel } from "@/lib/status-utils";
import { formatDate } from "@/lib/utils";

const PAGE_SIZE = 12;

interface ProjectsPageProps {
  searchParams: Promise<{
    page?: string;
    q?: string;
    sort?: string;
    status?: string;
    tag?: string;
  }>;
}

/**
 * Projects list page with search, sort, filter, and pagination
 */
export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const { t, locale } = await getTranslations();

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const searchQuery = (params.q || "").trim();
  const sortBy = params.sort || "newest";
  const statusFilter = params.status || "all";
  const tagFilter = params.tag || "all";
  const offset = (page - 1) * PAGE_SIZE;

  // Build WHERE conditions
  const conditions: SQL[] = [];
  if (searchQuery) {
    conditions.push(like(projects.title, `%${searchQuery}%`));
  }
  if (statusFilter !== "all") {
    conditions.push(eq(projects.status, statusFilter as "active" | "archived" | "draft"));
  }
  if (tagFilter !== "all") {
    const taggedProjectIds = db
      .select({ projectId: projectTags.projectId })
      .from(projectTags)
      .where(eq(projectTags.tagId, tagFilter));
    conditions.push(inArray(projects.id, taggedProjectIds));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Build ORDER BY
  const orderBy = (() => {
    switch (sortBy) {
      case "oldest":
        return asc(projects.createdAt);
      case "name":
        return asc(sql`lower(${projects.title})`);
      case "name-desc":
        return desc(sql`lower(${projects.title})`);
      default:
        return desc(projects.createdAt);
    }
  })();

  const [allProjects, totalResult, allTags, allProjectTags] = await Promise.all([
    db
      .select()
      .from(projects)
      .where(where)
      .orderBy(orderBy)
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ total: count() }).from(projects).where(where),
    db.select({ id: tags.id, name: tags.name }).from(tags).orderBy(asc(tags.name)),
    db.select({ projectId: projectTags.projectId, tagId: projectTags.tagId, tagName: tags.name })
      .from(projectTags)
      .innerJoin(tags, eq(projectTags.tagId, tags.id)),
  ]);

  // Build a map of projectId -> tags
  const projectTagsMap = new Map<string, { id: string; name: string }[]>();
  for (const pt of allProjectTags) {
    const arr = projectTagsMap.get(pt.projectId) || [];
    arr.push({ id: pt.tagId, name: pt.tagName });
    projectTagsMap.set(pt.projectId, arr);
  }

  const total = totalResult[0]?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = !!searchQuery || statusFilter !== "all" || tagFilter !== "all";

  return (
    <div className="mx-auto max-w-6xl py-4 sm:py-8">
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
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

      <div className="mb-6">
        <ProjectFilters tags={allTags} />
      </div>

      {allProjects.length === 0 && !hasFilters && page === 1 ? (
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
      ) : allProjects.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          {t("search.noResults")}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allProjects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="h-full min-h-[180px] transition-all duration-200 hover:shadow-lg hover:border-primary/20">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="line-clamp-2 text-base" title={project.title}>
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
                            ? formatDate(project.deadline, locale, "short")
                            : t("projects.deadlineNotSet")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          {t("projects.created")}:{" "}
                          {project.createdAt
                            ? formatDate(project.createdAt, locale, "short")
                            : t("projects.unknown")}
                        </span>
                      </div>
                    </div>
                    {(projectTagsMap.get(project.id) ?? []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {projectTagsMap.get(project.id)!.map((tag) => (
                          <Badge key={tag.id} variant="outline" className="text-xs">
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="mt-8 flex flex-col items-center gap-2">
            {total > PAGE_SIZE && (
              <p className="text-sm text-muted-foreground">
                {t("projects.showing", {
                  from: offset + 1,
                  to: Math.min(offset + PAGE_SIZE, total),
                  total,
                })}
              </p>
            )}
            <Pagination currentPage={page} totalPages={totalPages} />
          </div>
        </>
      )}
    </div>
  );
}
