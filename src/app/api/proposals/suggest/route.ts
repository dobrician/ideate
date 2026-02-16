import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { completeWithFallback } from "@/lib/llm";

const LOCALE = process.env.LOCALE || "en";

interface SuggestRequest {
  project: { title: string; description: string };
  proposals: { title: string; description?: string; summary?: string }[];
  locale?: string;
}

interface Suggestion {
  title: string;
  details: string;
  summary: string;
}

/**
 * Build the brainstorm prompt — verbatim from ideator.
 */
function buildPrompt(req: SuggestRequest): string {
  const locale = req.locale || LOCALE;
  const existingList = req.proposals.length
    ? req.proposals
        .map((p, i) => `${i + 1}. ${p.title} — ${p.description ?? p.summary ?? ""}`)
        .join("\n")
    : "(none)";

  return [
    `You are helping a team brainstorm NEW proposals for a project.`,
    `Respond ONLY in ${locale} (app locale from LOCALE env) with JSON array of up to 3 objects, each having "title", "details", and "summary".`,
    `Write "details" in structured Markdown with clear sections (use ## headings) and concise bullet lists/sub-lists for implementation notes/steps; provide enough context to act on the idea.`,
    `Each summary must be at most 240 characters. Do not number or bullet inside values.`,
    `Avoid duplicating or rephrasing existing proposals; skip anything that is too close.`,
    ``,
    `Project title: ${req.project.title}`,
    ``,
    `Project description: ${req.project.description}`,
    ``,
    `Existing proposals (avoid similar):`,
    existingList,
    ``,
    `Return JSON like: [{"title":"...","details":"...","summary":"..."}]`,
  ].join("\n");
}

/**
 * Parse AI output — handles code fences, extra text, partial JSON.
 */
function tryParseSuggestions(raw: string): Suggestion[] {
  // Strip code fences if present
  let cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "");

  // Try to extract JSON array
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!arrMatch) return [];

  try {
    const parsed = JSON.parse(arrMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item: unknown): item is Suggestion =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as Suggestion).title === "string" &&
          typeof (item as Suggestion).details === "string" &&
          typeof (item as Suggestion).summary === "string"
      )
      .slice(0, 3)
      .map((s) => ({
        title: s.title.slice(0, 200),
        details: s.details,
        summary: s.summary.slice(0, 240),
      }));
  } catch {
    return [];
  }
}

/**
 * POST /api/proposals/suggest
 * AI brainstorms up to 3 new proposal ideas for a project.
 */
export async function POST(request: Request) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as SuggestRequest;
    if (!body.project?.title) {
      return NextResponse.json(
        { proposals: [], error: "Project title is required" },
        { status: 400 }
      );
    }

    const prompt = buildPrompt(body);
    const { text } = await completeWithFallback(prompt, {
      maxTokens: 2048,
      temperature: 0.65,
    });

    if (!text) {
      return NextResponse.json({ proposals: [] });
    }

    const proposals = tryParseSuggestions(text);
    return NextResponse.json({ proposals });
  } catch {
    return NextResponse.json(
      { proposals: [], error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
