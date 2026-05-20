import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { completeWithFallback } from "@/lib/llm";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
import { findSimilarProposals } from "@/lib/semantic-search";
import { z } from "zod";

const LOCALE = process.env.LOCALE || "en";

const existingProposalSchema = z.object({
  id: z.string().max(100),
  title: z.string().max(500),
  description: z.string().max(2000).optional(),
  summary: z.string().max(500).optional(),
});

const similaritySchema = z.object({
  project: z.object({
    title: z.string().min(1).max(500),
    description: z.string().max(5000).default(""),
  }),
  existing: z.array(existingProposalSchema).max(100),
  proposal: z.object({
    title: z.string().min(1).max(500),
    description: z.string().max(2000).optional(),
  }),
  locale: z.string().max(10).optional(),
});

type ExistingProposal = z.infer<typeof existingProposalSchema>;

type SimilarityRequest = z.infer<typeof similaritySchema>;

interface SimilarityMatch {
  id: string;
  similarity: number;
  explanation: string;
}

/**
 * Jaccard token overlap fallback when LLM fails.
 */
function simpleSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, "")
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return Math.round((intersection / union) * 100);
}

/**
 * Generate keyword-based fallback similarities for all existing proposals.
 */
function fallbackSimilarities(
  existing: ExistingProposal[],
  proposal: { title: string; description?: string }
): SimilarityMatch[] {
  const newText = `${proposal.title} ${proposal.description || ""}`;
  return existing.map((p) => ({
    id: p.id,
    similarity: simpleSimilarity(
      `${p.title} ${p.description || ""}`,
      newText
    ),
    explanation: "",
  }));
}

/**
 * Build the similarity check prompt.
 * Asks the LLM to return ONLY the proposals it considers similar — keeps the
 * response small even when there are many existing proposals on the project.
 */
function buildPrompt(req: SimilarityRequest): string {
  const locale = req.locale || LOCALE;
  const existingMap: Record<string, { title: string; description?: string }> = {};
  for (const p of req.existing) {
    existingMap[p.id] = { title: p.title, description: p.description };
  }

  return [
    `Identify which of the EXISTING proposals are semantically similar to the NEW proposal on this project.`,
    `Return a JSON object: { "matches": [{ "id": "<existing-id>", "similarity": <0-100>, "explanation": "<concise human reason in ${locale}>" }] }.`,
    `Include an entry ONLY when similarity >= 30. Omit unrelated proposals entirely.`,
    `Compare intent and outcomes, not just keywords. Two proposals with overlapping goals (e.g. both advocate working from home) should score high (70+).`,
    `If nothing is similar, return { "matches": [] }.`,
    `Respond ONLY with valid JSON, no prose, no code fences.`,
    ``,
    `Project:`,
    JSON.stringify({ title: req.project.title, description: req.project.description }),
    ``,
    `Existing proposals (JSON map by id):`,
    JSON.stringify(existingMap),
    ``,
    `New proposal:`,
    JSON.stringify({ title: req.proposal.title, description: req.proposal.description }),
  ].join("\n");
}

/**
 * Parse the new-format LLM response: { matches: [{ id, similarity, explanation }] }
 * Falls back to legacy map-keyed-by-id format for robustness.
 */
function parseLlmMatches(text: string): Map<string, { similarity: number; explanation: string }> | null {
  const cleaned = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  let raw: unknown;
  try {
    raw = JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { raw = JSON.parse(m[0]); } catch { return null; }
  }
  if (!raw || typeof raw !== "object") return null;
  const out = new Map<string, { similarity: number; explanation: string }>();

  // New format: { matches: [...] }
  const matchesArr = (raw as { matches?: unknown }).matches;
  if (Array.isArray(matchesArr)) {
    for (const m of matchesArr) {
      if (m && typeof m === "object" && "id" in m && "similarity" in m) {
        const entry = m as { id: unknown; similarity: unknown; explanation?: unknown };
        if (typeof entry.id === "string" && typeof entry.similarity === "number") {
          out.set(entry.id, {
            similarity: entry.similarity,
            explanation: typeof entry.explanation === "string" ? entry.explanation : "",
          });
        }
      }
    }
    return out;
  }

  // Legacy format: { "<id>": { similarity, explanation } }
  for (const [id, val] of Object.entries(raw as Record<string, unknown>)) {
    if (val && typeof val === "object" && "similarity" in val) {
      const entry = val as { similarity: unknown; explanation?: unknown };
      if (typeof entry.similarity === "number") {
        out.set(id, {
          similarity: entry.similarity,
          explanation: typeof entry.explanation === "string" ? entry.explanation : "",
        });
      }
    }
  }
  return out;
}

/**
 * GET /api/proposals/similarity?proposalId=<id>&limit=<n>
 * Find proposals similar to the given one using embeddings.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const proposalId = request.nextUrl.searchParams.get("proposalId");
  if (!proposalId) {
    return NextResponse.json({ similar: [] });
  }

  const parsedLimit = parseInt(request.nextUrl.searchParams.get("limit") || "5", 10);
  const limit = Number.isNaN(parsedLimit) ? 5 : Math.min(Math.max(parsedLimit, 1), 20);

  try {
    const similar = await findSimilarProposals(proposalId, limit);
    return NextResponse.json({ similar });
  } catch {
    return NextResponse.json({ similar: [] });
  }
}

/**
 * POST /api/proposals/similarity
 * Check a new proposal against existing ones for overlap.
 */
export async function POST(request: Request) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipCheck = checkRateLimit(`similarity:ip:${getClientIp(request)}`, 20, 15 * 60_000);
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { matches: [], error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(ipCheck.retryAfterMs / 1000)) } }
    );
  }

  try {
    const raw = await request.json();
    const result = similaritySchema.safeParse(raw);
    if (!result.success) {
      return NextResponse.json(
        { matches: [], error: result.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }
    const body = result.data;

    if (!body.existing.length) {
      return NextResponse.json({ matches: [] });
    }

    const prompt = buildPrompt(body);
    // Each match entry is ~80-120 tokens (id + similarity + explanation).
    // Budget for ~20 returned matches with a comfortable headroom.
    const { text } = await completeWithFallback(prompt, {
      maxTokens: 2048,
      temperature: 0.2,
    });

    if (!text) {
      return NextResponse.json({
        matches: fallbackSimilarities(body.existing, body.proposal),
      });
    }

    const parsed = parseLlmMatches(text);
    if (!parsed) {
      return NextResponse.json({
        matches: fallbackSimilarities(body.existing, body.proposal),
      });
    }

    // Build output. Only include proposals the LLM flagged (similarity >= 30).
    // Other proposals are intentionally omitted — no need to send 17 entries
    // back when only 3 are similar.
    const allowedIds = new Set(body.existing.map((p) => p.id));
    const matches: SimilarityMatch[] = [];
    for (const [id, entry] of parsed) {
      if (!allowedIds.has(id)) continue;
      const sim = Math.min(100, Math.max(0, Math.round(entry.similarity)));
      if (sim < 30) continue;
      matches.push({ id, similarity: sim, explanation: entry.explanation });
    }

    return NextResponse.json({ matches });
  } catch {
    return NextResponse.json(
      { matches: [], error: "Failed to check similarity" },
      { status: 500 }
    );
  }
}
