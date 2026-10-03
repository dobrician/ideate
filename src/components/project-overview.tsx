import type { ReactNode } from "react";
import { ProjectContext } from "@/components/project-context";
import { Badge } from "@/components/ui/badge";
import { DeadlineCountdown } from "@/components/deadline-countdown";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { isProjectOpen, statusBadgeClass, statusLabel } from "@/lib/status-utils";
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
export function ProjectOverview({ project, stats, tags, t, tools }: ProjectOverviewProps) {
  const preview = project.summary || project.description?.split(/\n\s*\n/)[0];
  return (
    <section className={`rounded-xl border bg-muted p-4 sm:p-5 ${!isProjectOpen(project) ? "opacity-65" : ""}`} aria-labelledby="project-title">
      <div className="flex items-start justify-between gap-3">
        <h1 id="project-title" className="min-w-0 text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
          {project.title}
        </h1>
        <div className="shrink-0">{tools}</div>
      </div>
      <ProjectContext label={t("projects.context")}
        preview={preview && <MarkdownRenderer content={preview} />}
        context={<div className="space-y-2">
          {project.description && <MarkdownRenderer content={project.description} className="prose-p:my-2 prose-headings:mt-3 prose-headings:mb-1 prose-ul:my-2 prose-ol:my-2" />}
          {tags.length > 0 && <div className="flex flex-wrap gap-1">{tags.map(tag => <Badge key={tag.id} variant="secondary">{tag.name}</Badge>)}</div>}
        </div>}
        stats={<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground" aria-label={t("projects.votingSoFar")}>
          {project.status !== "active" && <Badge className={statusBadgeClass(project.status)}>{statusLabel(project.status, t)}</Badge>}
          <DeadlineCountdown deadline={project.deadline} compact />
          <span><strong className="font-semibold tabular-nums text-foreground">{stats.votes}</strong> {t("projects.votesCast", { count: stats.votes })}</span>
          <span><strong className="font-semibold tabular-nums text-foreground">{stats.voters}</strong> {t("projects.voters", { count: stats.voters })}</span>
        </div>}
      />
    </section>
  );
}
