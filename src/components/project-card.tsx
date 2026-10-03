import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { statusBadgeClass, statusLabel } from "@/lib/status-utils";
import { formatDate } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";

interface ProjectCardProps {
  project: { id: string; title: string; summary: string | null; description: string | null; status: string; deadline: Date };
  proposalCount: number;
  voteCount: number;
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
}

/** Preview a decision through its summary and participation, with one link to vote. */
export function ProjectCard({ project, proposalCount, voteCount, locale, t }: ProjectCardProps) {
  const summary = project.summary || project.description?.split(/\n\s*\n/)[0];
  return (
    <Link href={`/projects/${project.id}`} className="group flex h-full flex-col rounded-xl border bg-card p-5 transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-ring">
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 break-words text-base font-semibold leading-snug">{project.title}</h2>
        <Badge className={statusBadgeClass(project.status)}>{statusLabel(project.status, t)}</Badge>
      </div>
      {summary && <div className={`mt-3 text-sm leading-relaxed text-muted-foreground ${project.summary ? "" : "line-clamp-3"}`}><MarkdownRenderer content={summary} disableLinks /></div>}
      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-5 text-xs text-muted-foreground">
        <span><strong className="font-medium tabular-nums text-foreground">{proposalCount}</strong> {t("projects.proposals", { count: proposalCount })}</span>
        <span><strong className="font-medium tabular-nums text-foreground">{voteCount}</strong> {t("projects.votesCast", { count: voteCount })}</span>
        <span className="ml-auto">{t("projects.deadline")}: {formatDate(project.deadline, locale, "short")}</span>
      </div>
    </Link>
  );
}
