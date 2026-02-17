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

export function formatDate(date: Date | null): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
