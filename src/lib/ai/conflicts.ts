/**
 * Conflict Detection Engine — detects contradictory proposals within a project.
 * Uses embedding similarity + LLM analysis to identify semantic conflicts.
 * Falls back to keyword-based contradiction detection when LLM unavailable.
 */

import { db } from "@/db";
import { proposals } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getEmbedding,
  getEmbeddingsByType,
  cosineSimilarity,
} from "@/lib/embeddings";
import { completeWithFallback } from "@/lib/llm";
import { logger } from "@/lib/logger";
import { enqueue, registerHandler } from "@/lib/queue";

const log = logger.child({ module: "ai-conflicts" });

export type ConflictSeverity = "high" | "medium" | "low";

export interface ConflictResult {
  proposalAId: string;
  proposalATitle: string;
  proposalBId: string;
  proposalBTitle: string;
  severity: ConflictSeverity;
  confidence: number;
  explanation: string;
}

/**
 * Detect conflicts between proposals within a project.
 * First finds semantically similar pairs, then checks for contradiction.
 */
export async function detectConflicts(
  projectId: string,
  threshold = 0.3
): Promise<ConflictResult[]> {
  try {
    const projectProposals = await db
      .select({
        id: proposals.id,
        title: proposals.title,
        description: proposals.description,
      })
      .from(proposals)
      .where(eq(proposals.projectId, projectId));

    if (projectProposals.length < 2) return [];

    // Find similar pairs via embeddings
    const pairs = await findSimilarPairs(projectProposals, threshold);

    // Analyze each pair for contradiction
    const conflicts: ConflictResult[] = [];
    for (const pair of pairs.slice(0, 10)) {
      const conflict = await analyzeConflict(pair.a, pair.b, pair.similarity);
      if (conflict) conflicts.push(conflict);
    }

    return conflicts.sort((a, b) => b.confidence - a.confidence);
  } catch (err) {
    log.error({ err, projectId }, "Conflict detection failed");
    return [];
  }
}

/**
 * Check if a specific proposal conflicts with any existing proposals in its project.
 */
export async function checkProposalConflicts(
  proposalId: string
): Promise<ConflictResult[]> {
  const [proposal] = await db
    .select({
      id: proposals.id,
      title: proposals.title,
      description: proposals.description,
      projectId: proposals.projectId,
    })
    .from(proposals)
    .where(eq(proposals.id, proposalId))
    .limit(1);

  if (!proposal) return [];

  const otherProposals = await db
    .select({
      id: proposals.id,
      title: proposals.title,
      description: proposals.description,
    })
    .from(proposals)
    .where(eq(proposals.projectId, proposal.projectId));

  const others = otherProposals.filter((p) => p.id !== proposalId);
  if (others.length === 0) return [];

  const conflicts: ConflictResult[] = [];
  const proposalEmb = await getEmbedding("proposal", proposalId);

  for (const other of others.slice(0, 20)) {
    const otherEmb = await getEmbedding("proposal", other.id);
    let similarity = 0.5; // default when no embeddings
    if (proposalEmb && otherEmb && proposalEmb.vector.length === otherEmb.vector.length) {
      similarity = cosineSimilarity(proposalEmb.vector, otherEmb.vector);
    }
    if (similarity < 0.2) continue;

    const conflict = await analyzeConflict(
      { id: proposal.id, title: proposal.title, description: proposal.description },
      other,
      similarity
    );
    if (conflict) conflicts.push(conflict);
  }

  return conflicts.sort((a, b) => b.confidence - a.confidence);
}

interface ProposalPair {
  a: { id: string; title: string; description: string | null };
  b: { id: string; title: string; description: string | null };
  similarity: number;
}

/**
 * Find proposal pairs with high embedding similarity (candidates for conflict).
 */
async function findSimilarPairs(
  proposalList: Array<{ id: string; title: string; description: string | null }>,
  threshold: number
): Promise<ProposalPair[]> {
  const allEmbeddings = await getEmbeddingsByType("proposal");
  const embMap = new Map(allEmbeddings.map((e) => [e.entityId, e.vector]));
  const proposalIds = new Set(proposalList.map((p) => p.id));

  const pairs: ProposalPair[] = [];

  for (let i = 0; i < proposalList.length; i++) {
    for (let j = i + 1; j < proposalList.length; j++) {
      const a = proposalList[i];
      const b = proposalList[j];
      const vecA = embMap.get(a.id);
      const vecB = embMap.get(b.id);

      let similarity = 0;
      if (vecA && vecB && vecA.length === vecB.length) {
        similarity = cosineSimilarity(vecA, vecB);
      } else {
        // Fallback: keyword overlap
        similarity = jaccardSimilarity(
          `${a.title} ${a.description ?? ""}`,
          `${b.title} ${b.description ?? ""}`
        );
      }

      if (similarity >= threshold) {
        pairs.push({ a, b, similarity });
      }
    }
  }

  return pairs.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Analyze whether two similar proposals are actually contradictory.
 * Uses LLM when available, falls back to heuristic analysis.
 */
async function analyzeConflict(
  a: { id: string; title: string; description: string | null },
  b: { id: string; title: string; description: string | null },
  similarity: number
): Promise<ConflictResult | null> {
  // Try LLM-based conflict analysis
  const llmResult = await llmConflictAnalysis(a, b);
  if (llmResult) return llmResult;

  // Fallback: heuristic — high similarity between opposing keywords suggests conflict
  return heuristicConflictAnalysis(a, b, similarity);
}

/**
 * LLM-based conflict analysis between two proposals.
 */
async function llmConflictAnalysis(
  a: { id: string; title: string; description: string | null },
  b: { id: string; title: string; description: string | null }
): Promise<ConflictResult | null> {
  try {
    const prompt = [
      "Analyze whether these two proposals conflict or contradict each other.",
      "Respond ONLY with valid JSON: {\"conflict\": boolean, \"severity\": \"high\"|\"medium\"|\"low\", \"confidence\": 0-100, \"explanation\": \"brief reason\"}",
      "If they are complementary or unrelated, set conflict to false.",
      "",
      `Proposal A: ${a.title}`,
      a.description ? `Description: ${a.description.slice(0, 500)}` : "",
      "",
      `Proposal B: ${b.title}`,
      b.description ? `Description: ${b.description.slice(0, 500)}` : "",
    ].join("\n");

    const { text } = await completeWithFallback(prompt, {
      maxTokens: 200,
      temperature: 0.2,
    });

    if (!text) return null;

    const parsed = extractJson(text);
    if (!parsed || !parsed.conflict) return null;

    return {
      proposalAId: a.id,
      proposalATitle: a.title,
      proposalBId: b.id,
      proposalBTitle: b.title,
      severity: validateSeverity(parsed.severity),
      confidence: Math.min(Math.max(Number(parsed.confidence) || 50, 0), 100),
      explanation: String(parsed.explanation || "Potential conflict detected"),
    };
  } catch (err) {
    log.warn({ err }, "LLM conflict analysis failed");
    return null;
  }
}

/**
 * Heuristic conflict analysis: checks for contradictory keywords.
 */
function heuristicConflictAnalysis(
  a: { id: string; title: string; description: string | null },
  b: { id: string; title: string; description: string | null },
  similarity: number
): ConflictResult | null {
  const textA = `${a.title} ${a.description ?? ""}`.toLowerCase();
  const textB = `${b.title} ${b.description ?? ""}`.toLowerCase();

  const CONTRADICTION_PAIRS = [
    ["increase", "decrease"],
    ["add", "remove"],
    ["expand", "reduce"],
    ["enable", "disable"],
    ["open", "close"],
    ["start", "stop"],
    ["allow", "prohibit"],
    ["accept", "reject"],
    ["build", "demolish"],
    ["create", "delete"],
  ];

  let contradictionCount = 0;
  for (const [wordA, wordB] of CONTRADICTION_PAIRS) {
    if (
      (textA.includes(wordA) && textB.includes(wordB)) ||
      (textA.includes(wordB) && textB.includes(wordA))
    ) {
      contradictionCount++;
    }
  }

  if (contradictionCount === 0) return null;

  const confidence = Math.min(30 + contradictionCount * 15 + similarity * 20, 80);

  return {
    proposalAId: a.id,
    proposalATitle: a.title,
    proposalBId: b.id,
    proposalBTitle: b.title,
    severity: contradictionCount >= 2 ? "high" : "medium",
    confidence: Math.round(confidence),
    explanation: `Detected ${contradictionCount} contradictory keyword pair(s) with ${Math.round(similarity * 100)}% topic similarity`,
  };
}

/**
 * Jaccard similarity between tokenized texts.
 */
function jaccardSimilarity(textA: string, textB: string): number {
  const tokensA = new Set(
    textA.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2)
  );
  const tokensB = new Set(
    textB.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2)
  );
  const intersection = new Set([...tokensA].filter((t) => tokensB.has(t)));
  const union = new Set([...tokensA, ...tokensB]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

/** Extract JSON from a possibly-markdown-wrapped LLM response. */
function extractJson(text: string): Record<string, unknown> | null {
  try {
    // Try direct parse
    return JSON.parse(text);
  } catch {
    // Try extracting from code block
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try { return JSON.parse(match[1].trim()); } catch { /* fall through */ }
    }
    // Try finding JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]); } catch { /* fall through */ }
    }
    return null;
  }
}

function validateSeverity(s: unknown): ConflictSeverity {
  if (s === "high" || s === "medium" || s === "low") return s;
  return "medium";
}

// ─── Job Queue Integration ──────────────────────────────────────────────

const JOB_TYPE = "ai-conflict-detection";

/** Register the conflict detection job handler. */
export function registerConflictHandlers(): void {
  registerHandler(JOB_TYPE, handleConflictJob);
}

/** Enqueue a conflict detection job for a project. */
export async function enqueueConflictDetection(projectId: string): Promise<string> {
  return enqueue(JOB_TYPE, { projectId });
}

async function handleConflictJob(payload: Record<string, unknown>): Promise<void> {
  const projectId = payload.projectId as string;
  if (!projectId) throw new Error("Missing projectId in conflict job payload");

  const conflicts = await detectConflicts(projectId);
  log.info(
    { projectId, conflictsFound: conflicts.length },
    "Conflict detection completed"
  );
}
