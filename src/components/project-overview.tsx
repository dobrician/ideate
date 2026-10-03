import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DeadlineCountdown } from "@/components/deadline-countdown";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { statusBadgeClass, statusLabel } from "@/lib/status-utils";
import { formatDate } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";

interface ProjectOverviewProps {
  project: {
    title: string; description: string | null; summary: string | null;
    status: string; deadline: Date; createdAt: Date | null; updatedAt: Date | null;
  };
  stats: { votes: number; voters: number };
  tags: { id: string; name: string }[];
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
  tools: ReactNode;
}

/** Present the decision and participation first, with context revealed on demand. */
export function ProjectOverview({ project, stats, tags, locale, t, tools }: ProjectOverviewProps) {
  const preview = project.summary || project.description?.split(/\n\s*\n/)[0];
  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="project-title">
      <div className="flex items-start justify-between gap-3">
        <h1 id="project-title" className="min-w-0 text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
          {project.title}
        </h1>
        <div className="shrink-0">{tools}</div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
        <Badge className={statusBadgeClass(project.status)}>{statusLabel(project.status, t)}</Badge>
        <DeadlineCountdown deadline={project.deadline} />
      </div>
      {preview && (
        <div className={`mt-3 text-sm leading-relaxed text-muted-foreground ${project.summary ? "" : "line-clamp-2"}`}>
          <MarkdownRenderer content={preview} />
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground" aria-label={t("projects.votingSoFar")}>
          <span><strong className="font-semibold tabular-nums text-foreground">{stats.votes}</strong> {t("projects.votesCast", { count: stats.votes })}</span>
          <span><strong className="font-semibold tabular-nums text-foreground">{stats.voters}</strong> {t("projects.voters", { count: stats.voters })}</span>
        </p>
        <details className="group w-full sm:w-auto sm:flex-1 open:basis-full open:flex-none open:w-full">
          <summary className="flex min-h-8 cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring sm:justify-end [&::-webkit-details-marker]:hidden">
            {t("projects.context")}
            <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="mt-3 space-y-4 border-t pt-4 text-sm text-muted-foreground">
            {project.description && <MarkdownRenderer content={project.description} />}
            {tags.length > 0 && <div className="flex flex-wrap gap-1">{tags.map(tag => <Badge key={tag.id} variant="secondary">{tag.name}</Badge>)}</div>}
            <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
              {project.createdAt && <div><dt>{t("projects.created")}</dt><dd>{formatDate(project.createdAt, locale)}</dd></div>}
              {project.updatedAt && <div><dt>{t("projects.lastUpdated")}</dt><dd>{formatDate(project.updatedAt, locale)}</dd></div>}
            </dl>
          </div>
        </details>
      </div>
    </section>
  );
}
