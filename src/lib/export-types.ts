/**
 * Shared types and helpers for export utilities.
 */

export interface ExportComment {
  content: string;
  authorName: string;
  createdAt: Date | null;
}

export interface ExportProposal {
  title: string;
  description: string | null;
  summary: string | null;
  authorName: string;
  createdAt: Date | null;
  upvotes: number;
  downvotes: number;
  comments: ExportComment[];
}

export interface ExportProject {
  title: string;
  description: string | null;
  status: string;
  deadline: Date | null;
  createdAt: Date | null;
  proposals: ExportProposal[];
  projectComments?: ExportComment[];
}

export function formatDate(date: Date | null, locale?: string): string {
  if (!date) return "N/A";
  const env = process.env.LOCALE;
  const tag = (locale ?? (env && env.length > 1 ? env : null) ?? "en-US").replace(/_/g, "-");
  return new Date(date).toLocaleDateString(tag, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
