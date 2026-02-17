/**
 * CSV export utilities for generating project reports.
 */

import type { ExportProject } from "@/lib/export-types";
import { formatDate } from "@/lib/export-types";

/**
 * Generate CSV content for a project report
 */
export function generateCsv(project: ExportProject): string {
  const rows: string[][] = [];

  rows.push([
    "Type",
    "Title",
    "Author",
    "Description",
    "Upvotes",
    "Downvotes",
    "Date",
  ]);

  rows.push([
    "Project",
    project.title,
    "",
    project.description || "",
    "",
    "",
    formatDate(project.createdAt),
  ]);

  for (const pc of project.projectComments ?? []) {
    rows.push([
      "ProjectComment",
      project.title,
      pc.authorName,
      pc.content,
      "",
      "",
      formatDate(pc.createdAt),
    ]);
  }

  for (const proposal of project.proposals) {
    rows.push([
      "Proposal",
      proposal.title,
      proposal.authorName,
      proposal.description || proposal.summary || "",
      String(proposal.upvotes),
      String(proposal.downvotes),
      formatDate(proposal.createdAt),
    ]);

    for (const comment of proposal.comments) {
      rows.push([
        "Comment",
        `Re: ${proposal.title}`,
        comment.authorName,
        comment.content,
        "",
        "",
        formatDate(comment.createdAt),
      ]);
    }
  }

  return rows.map((row) => row.map(escapeCsvField).join(",")).join("\n");
}

function escapeCsvField(field: string): string {
  const str = field.replace(/\r?\n/g, " ");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
