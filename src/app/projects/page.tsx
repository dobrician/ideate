import Link from "next/link";
import { db } from "@/db";
import { projects, proposals, votes, projectTags } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProjectCard } from "@/components/project-card";
import { Pagination } from "@/components/pagination";
import { ProjectFilters } from "@/components/project-filters";
import { FolderOpen } from "lucide-react";
import { desc, asc, count, like, eq, and, sql, inArray, type SQL } from "drizzle-orm";
import { getTranslations } from "@/lib/i18n-server";

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
  if (statusFilter === "all-with-archived") {
    // explicit opt-in: no status filter, include archived
  } else if (statusFilter !== "all") {
    conditions.push(eq(projects.status, statusFilter as "active" | "archived" | "draft"));
  } else {
    // default "all" hides archived
    conditions.push(sql`${projects.status} != 'archived'`);
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

  const [allProjects, totalResult] = await Promise.all([
    db
      .select()
      .from(projects)
      .where(where)
      .orderBy(orderBy)
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ total: count() }).from(projects).where(where),
  ]);
  const projectIds = allProjects.map(project => project.id);
  const [proposalCounts, voteCounts] = await Promise.all([
    db.select({ projectId: proposals.projectId, total: count() }).from(proposals)
      .where(inArray(proposals.projectId, projectIds)).groupBy(proposals.projectId),
    db.select({ projectId: proposals.projectId, total: count() }).from(votes)
      .innerJoin(proposals, eq(votes.proposalId, proposals.id))
      .where(inArray(proposals.projectId, projectIds)).groupBy(proposals.projectId),
  ]);
  const proposalCountsMap = new Map(proposalCounts.map(row => [row.projectId, row.total]));
  const voteCountsMap = new Map(voteCounts.map(row => [row.projectId, row.total]));

  const total = totalResult[0]?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = !!searchQuery || statusFilter !== "all" || tagFilter !== "all";

  return (
    <div className="mx-auto max-w-4xl py-4 sm:py-8">
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("projects.title")}</h1>
        </div>
        <Button asChild>
          <Link href="/projects/new">{t("projects.createProject")}</Link>
        </Button>
      </div>

      <div className="mb-6">
        <ProjectFilters />
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
          <div className="grid gap-4 sm:grid-cols-2">
            {allProjects.map(project => (
              <ProjectCard key={project.id} project={project}
                proposalCount={proposalCountsMap.get(project.id) ?? 0}
                voteCount={voteCountsMap.get(project.id) ?? 0} locale={locale} t={t} />
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
            <Pagination currentPage={page} totalPages={totalPages} compactOnMobile />
          </div>
        </>
      )}
    </div>
  );
}
