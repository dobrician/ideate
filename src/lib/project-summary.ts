/**
 * Project summary generation using AI.
 * Reuses generateSummaryFromText from ai.ts with project-specific prompt.
 */

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateSummaryFromText, fallbackSummary } from "@/lib/ai";

const PROJECT_SUMMARY_WORD_LIMIT = 48;
const PROJECT_SUMMARY_CHAR_LIMIT = 320;

/**
 * Build the user prompt for project summary generation.
 * Verbatim from ideator — do not modify.
 */
function buildProjectSummaryPrompt(title: string, description: string): string {
  return [
    "Write a terse noun-phrase summary (no imperatives, no second-person, no pleasantries).",
    "Assume the title is shown separately; do not repeat or paraphrase the title or its keywords.",
    "Describe what the project collects (types of proposals/ideas) and any criteria or expectations mentioned; omit if not present.",
    "Keep it neutral/descriptive, as a short label for the project purpose.",
    "",
    `Title: ${title}`,
    "",
    "Description:",
    description,
  ].join("\n");
}

/**
 * Generate and persist an AI summary for a project.
 * @param projectId - The project ID
 * @param opts.force - Regenerate even if summary already exists
 * @returns The generated summary string, or null on failure
 */
export async function generateProjectSummary(
  projectId: string,
  opts: { force?: boolean } = {}
): Promise<string | null> {
  const project = await db
    .select({
      id: projects.id,
      title: projects.title,
      description: projects.description,
      summary: projects.summary,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (project.length === 0) return null;

  const { title, description, summary: existing } = project[0];

  if (existing && !opts.force) return existing;
  if (!description) {
    return fallbackSummary(title, PROJECT_SUMMARY_CHAR_LIMIT);
  }

  const prompt = buildProjectSummaryPrompt(title, description);
  const generated = await generateSummaryFromText(
    prompt,
    PROJECT_SUMMARY_WORD_LIMIT,
    PROJECT_SUMMARY_CHAR_LIMIT
  );

  const finalSummary =
    fallbackSummary(generated, PROJECT_SUMMARY_CHAR_LIMIT) ??
    fallbackSummary(description, PROJECT_SUMMARY_CHAR_LIMIT);

  if (finalSummary) {
    await db
      .update(projects)
      .set({ summary: finalSummary })
      .where(eq(projects.id, projectId));

    revalidatePath("/dashboard");
    revalidatePath(`/projects/${projectId}`);
  }

  return finalSummary;
}
