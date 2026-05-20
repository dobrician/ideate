/**
 * AI summarization utilities.
 * Wraps the LLM layer with domain-specific prompts and fallback logic.
 */

import { completeWithFallback } from "@/lib/llm";

const LOCALE = process.env.LOCALE || "en";

/**
 * Build a system prompt for summarization with word/char constraints
 */
function systemPrompt(maxWords: number, maxChars?: number): string {
  const charConstraint = maxChars ? ` and at most ${maxChars} characters` : "";
  return [
    `You are summarizing a project or proposal.`,
    `Respond ONLY in the "${LOCALE}" language (translate if needed), using correct diacritics for that locale.`,
    `Assume the reader already sees the title separately; do not repeat or rephrase it.`,
    `Write a single crisp sentence with no bullets or headings, removing redundancy and filler.`,
    `Keep it easy to read and remember.`,
    `If the input contains URLs whose contents you cannot fetch, silently ignore those URLs and summarize only from the surrounding text. Never mention that you cannot access a link, cannot browse, or lack web access — produce a normal summary from whatever textual context is available, or fall back to describing the input at face value if there is nothing else.`,
    `Use at most ${maxWords} words${charConstraint}.`,
  ].join(" ");
}

/**
 * Generate an AI summary from text input
 */
export async function generateSummaryFromText(
  input: string,
  maxWords = 60,
  maxChars?: number
): Promise<string | null> {
  if (!input.trim()) return null;

  try {
    const prompt = `${systemPrompt(maxWords, maxChars)}\n\n${input}`;
    const { text } = await completeWithFallback(prompt, {
      maxTokens: 180,
      temperature: 0.4,
    });
    if (!text) return null;
    return maxChars ? text.slice(0, maxChars) : text.slice(0, 480);
  } catch {
    return null;
  }
}

/**
 * Truncate text as a fallback when AI is unavailable
 */
export function fallbackSummary(
  text: string | null | undefined,
  maxChars = 240
): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars - 1).trimEnd()}…`;
}

const PROPOSAL_SUMMARY_WORD_LIMIT = 42;
const PROPOSAL_SUMMARY_CHAR_LIMIT = 260;

/**
 * Build an AI summary for a proposal
 */
export async function buildProposalSummary(
  title: string,
  description: string | null | undefined
): Promise<string | null> {
  const promptSource = [
    "Provide a concise explanation of what this proposal aims to do and why it matters.",
    "Assume the title is shown separately; do not restate or paraphrase it.",
    `Title: ${title}`,
    `Description:\n${description ?? ""}`,
  ].join("\n\n");

  const generated = await generateSummaryFromText(
    promptSource,
    PROPOSAL_SUMMARY_WORD_LIMIT,
    PROPOSAL_SUMMARY_CHAR_LIMIT
  );

  return (
    fallbackSummary(generated, PROPOSAL_SUMMARY_CHAR_LIMIT) ??
    fallbackSummary(description || title, PROPOSAL_SUMMARY_CHAR_LIMIT)
  );
}

