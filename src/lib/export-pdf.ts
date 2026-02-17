/**
 * PDF export utilities for generating project reports using jsPDF.
 */

import type { ExportProject } from "@/lib/export-types";
import { formatDate } from "@/lib/export-types";

/**
 * Generate a real PDF binary (ArrayBuffer) for a project report using jspdf.
 */
export async function generatePdf(
  project: ExportProject
): Promise<ArrayBuffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = 20;

  function checkPage(needed: number) {
    const pageH = doc.internal.pageSize.getHeight();
    if (y + needed > pageH - 15) {
      doc.addPage();
      y = 20;
    }
  }

  function wrapText(text: string, maxW: number, fontSize: number): string[] {
    doc.setFontSize(fontSize);
    return doc.splitTextToSize(text, maxW) as string[];
  }

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  const titleLines = wrapText(project.title, contentW, 20);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 8 + 4;

  // Meta line
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  const meta = `Status: ${project.status}  |  Deadline: ${formatDate(project.deadline)}  |  Created: ${formatDate(project.createdAt)}`;
  doc.text(meta, margin, y);
  y += 6;
  doc.setTextColor(0);

  // Description
  if (project.description) {
    doc.setFontSize(10);
    const descLines = wrapText(project.description, contentW, 10);
    checkPage(descLines.length * 5);
    doc.text(descLines, margin, y);
    y += descLines.length * 5 + 4;
  }

  // Summary stats
  const totalVotes = project.proposals.reduce(
    (sum, p) => sum + p.upvotes + p.downvotes,
    0
  );
  const totalComments =
    project.proposals.reduce((sum, p) => sum + p.comments.length, 0) +
    (project.projectComments?.length ?? 0);

  checkPage(12);
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, y - 2, contentW, 10, 2, 2, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(
    `${project.proposals.length} proposals   |   ${totalVotes} votes   |   ${totalComments} comments`,
    margin + 4,
    y + 5
  );
  y += 16;

  // Project discussion
  if (project.projectComments && project.projectComments.length > 0) {
    checkPage(12);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Project Discussion", margin, y);
    y += 8;

    for (const c of project.projectComments) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      checkPage(12);
      doc.text(`${c.authorName}  (${formatDate(c.createdAt)})`, margin + 4, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      const cLines = wrapText(c.content, contentW - 8, 9);
      checkPage(cLines.length * 4);
      doc.text(cLines, margin + 4, y);
      y += cLines.length * 4 + 3;
    }
    y += 4;
  }

  // Proposals
  checkPage(12);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Proposals", margin, y);
  y += 8;

  if (project.proposals.length === 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text("No proposals yet.", margin, y);
    y += 6;
  }

  for (const proposal of project.proposals) {
    checkPage(30);
    // Proposal border box top
    doc.setDrawColor(200);
    doc.line(margin, y - 2, margin + contentW, y - 2);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    const pTitleLines = wrapText(proposal.title, contentW - 4, 12);
    doc.text(pTitleLines, margin + 2, y + 3);
    y += pTitleLines.length * 5 + 4;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(
      `by ${proposal.authorName}  |  ${formatDate(proposal.createdAt)}`,
      margin + 2,
      y
    );
    y += 5;
    doc.setTextColor(0);

    if (proposal.description) {
      doc.setFontSize(9);
      const dLines = wrapText(proposal.description, contentW - 4, 9);
      checkPage(dLines.length * 4);
      doc.text(dLines, margin + 2, y);
      y += dLines.length * 4 + 3;
    }

    // Votes bar
    const total = proposal.upvotes + proposal.downvotes;
    const proPct =
      total > 0 ? Math.round((proposal.upvotes / total) * 100) : 0;
    checkPage(12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 163, 74);
    doc.text(`+${proposal.upvotes} Pro`, margin + 2, y);
    doc.setTextColor(220, 38, 38);
    doc.text(`-${proposal.downvotes} Contra`, margin + 30, y);
    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    doc.text(`${proPct}% approval`, margin + 62, y);
    doc.setTextColor(0);
    y += 5;

    // Approval bar
    const barW = contentW - 4;
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(margin + 2, y, barW, 3, 1, 1, "F");
    if (proPct > 0) {
      doc.setFillColor(187, 247, 208);
      doc.roundedRect(
        margin + 2,
        y,
        Math.max((barW * proPct) / 100, 2),
        3,
        1,
        1,
        "F"
      );
    }
    y += 7;

    // Comments for this proposal
    if (proposal.comments.length > 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      checkPage(8);
      doc.text(
        `${proposal.comments.length} comment${proposal.comments.length !== 1 ? "s" : ""}`,
        margin + 2,
        y
      );
      y += 4;

      for (const comment of proposal.comments) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        checkPage(10);
        doc.text(
          `${comment.authorName}  (${formatDate(comment.createdAt)})`,
          margin + 6,
          y
        );
        y += 3;
        doc.setFont("helvetica", "normal");
        const cLines = wrapText(comment.content, contentW - 12, 8);
        checkPage(cLines.length * 3.5);
        doc.text(cLines, margin + 6, y);
        y += cLines.length * 3.5 + 2;
      }
    }
    y += 6;
  }

  // Footer
  checkPage(12);
  doc.setDrawColor(200);
  doc.line(margin, y, margin + contentW, y);
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    `Generated by Ideate on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    margin,
    y
  );

  return doc.output("arraybuffer");
}
