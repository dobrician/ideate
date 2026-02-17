import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { completeWithFallback } from "@/lib/llm";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
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
 * Extract JSON from LLM output — handles malformed/truncated output.
 */
function extractJson(text: string): Record<string, { similarity: number; explanation: string }> | null {
  // Strip code fences
  let cleaned = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();

  // Try direct parse
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === "object" && parsed !== null) return parsed;
  } catch {
    // Try regex extraction
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Build the similarity check prompt — verbatim from ideator.
 */
function buildPrompt(req: SimilarityRequest): string {
  const locale = req.locale || LOCALE;
  const existingMap: Record<string, { title: string; description?: string }> = {};
  for (const p of req.existing) {
    existingMap[p.id] = { title: p.title, description: p.description };
  }

  return [
    `We have a project and a list of existing proposals for it.`,
    `Return a JSON object where each key is an existing proposal ID and value is { "similarity": 0-100, "explanation": "<human, concise reason in ${locale}>" }.`,
    `Compare each existing proposal one-to-one against the NEW proposal provided.`,
    `Use the project context to understand intent and avoid keyword-only reasoning.`,
    `Be specific (e.g., overlapping KPIs, duplicate features, same outcomes).`,
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
    const { text } = await completeWithFallback(prompt, {
      maxTokens: 320,
      temperature: 0.2,
      topP: 0.8,
    });

    if (!text) {
      // Fallback to Jaccard
      return NextResponse.json({
        matches: fallbackSimilarities(body.existing, body.proposal),
      });
    }

    const parsed = extractJson(text);
    if (!parsed) {
      return NextResponse.json({
        matches: fallbackSimilarities(body.existing, body.proposal),
      });
    }

    // Map parsed results, filling gaps with 0
    const matches: SimilarityMatch[] = body.existing.map((p) => {
      const entry = parsed[p.id];
      if (entry && typeof entry.similarity === "number") {
        return {
          id: p.id,
          similarity: Math.min(100, Math.max(0, Math.round(entry.similarity))),
          explanation: entry.explanation || "",
        };
      }
      // Fill gap with Jaccard fallback for this specific proposal
      return {
        id: p.id,
        similarity: simpleSimilarity(
          `${p.title} ${p.description || ""}`,
          `${body.proposal.title} ${body.proposal.description || ""}`
        ),
        explanation: "",
      };
    });

    return NextResponse.json({ matches });
  } catch {
    return NextResponse.json(
      { matches: [], error: "Failed to check similarity" },
      { status: 500 }
    );
  }
}
