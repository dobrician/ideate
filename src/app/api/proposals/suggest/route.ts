import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { completeWithFallback, isAiConfigured, isAiRateLimited } from "@/lib/llm";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
import { z } from "zod";

const LOCALE = process.env.LOCALE || "en";

const suggestSchema = z.object({
  project: z.object({
    title: z.string().min(1).max(500),
    description: z.string().max(5000).default(""),
  }),
  proposals: z
    .array(
      z.object({
        title: z.string().max(500),
        description: z.string().max(2000).optional(),
        summary: z.string().max(500).optional(),
      })
    )
    .max(100)
    .default([]),
  locale: z.string().max(10).optional(),
});

type SuggestRequest = z.infer<typeof suggestSchema>;

interface Suggestion {
  title: string;
  details: string;
  summary: string;
}

/**
 * Build the brainstorm prompt.
 * When `strict` is true, the prompt emphasises JSON-only output (used for retries).
 */
function buildPrompt(req: SuggestRequest, strict = false): string {
  const locale = req.locale || LOCALE;
  const existingList = req.proposals.length
    ? req.proposals
        .map((p, i) => `${i + 1}. ${p.title} — ${p.description ?? p.summary ?? ""}`)
        .join("\n")
    : "(none)";

  const lines = [
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
  ];

  if (strict) {
    lines.push(
      ``,
      `IMPORTANT: Return ONLY the raw JSON array. No prose, no code fences, no explanation.`
    );
  }

  return lines.join("\n");
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

  const ipCheck = checkRateLimit(`suggest:ip:${getClientIp(request)}`, 10, 15 * 60_000);
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { proposals: [], error: "Too many requests", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(ipCheck.retryAfterMs / 1000)) } }
    );
  }

  try {
    const raw = await request.json();
    const parsed = suggestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { proposals: [], error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }
    const body = parsed.data;

    if (!isAiConfigured()) {
      return NextResponse.json(
        { proposals: [], error: "no_api_keys", code: "NO_KEYS" },
        { status: 503 }
      );
    }

    if (isAiRateLimited()) {
      return NextResponse.json(
        { proposals: [], error: "Rate limited — try again later", code: "RATE_LIMITED" },
        { status: 429 }
      );
    }

    const prompt = buildPrompt(body);
    const { text, modelUsed } = await completeWithFallback(prompt, {
      maxTokens: 2048,
      temperature: 0.65,
    });

    if (!text) {
      return NextResponse.json(
        { proposals: [], error: "AI temporarily unavailable", code: "AI_UNAVAILABLE" },
        { status: 503 }
      );
    }

    let proposals = tryParseSuggestions(text);

    // Retry once with stricter prompt if first attempt returned text but parsed empty
    if (proposals.length === 0) {
      const retryPrompt = buildPrompt(body, true);
      const retry = await completeWithFallback(retryPrompt, {
        maxTokens: 2048,
        temperature: 0.4,
      });
      if (retry.text) {
        proposals = tryParseSuggestions(retry.text);
      }
    }

    return NextResponse.json({ proposals, modelUsed });
  } catch {
    return NextResponse.json(
      { proposals: [], error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
