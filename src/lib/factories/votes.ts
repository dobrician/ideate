import { randomUUID } from "crypto";

export interface DemoVote {
  proposalId: string;
  userId: string;
  value: number; // 1 = for, -1 = against
}

type VotePattern = "popular" | "controversial" | "polarizing" | "lukewarm" | "niche";

/**
 * Generate a realistic voting pattern.
 * Each voter either votes +1, -1, or abstains (not included).
 */
function applyPattern(
  proposalId: string,
  voterIds: string[],
  pattern: VotePattern,
): DemoVote[] {
  const votes: DemoVote[] = [];
  const total = voterIds.length;

  for (let i = 0; i < total; i++) {
    const position = i / total; // 0..1
    let value: number | null = null;

    switch (pattern) {
      case "popular":
        // ~75% for, ~15% against, ~10% abstain
        if (position < 0.75) value = 1;
        else if (position < 0.90) value = -1;
        break;
      case "controversial":
        // ~50-50 split, almost everyone votes
        if (position < 0.48) value = 1;
        else if (position < 0.95) value = -1;
        break;
      case "polarizing":
        // Strong opinions both ways, few abstain
        if (position < 0.55) value = 1;
        else if (position < 0.92) value = -1;
        break;
      case "lukewarm":
        // Few votes overall, slightly positive
        if (position < 0.35) value = 1;
        else if (position < 0.45) value = -1;
        break;
      case "niche":
        // Fewer people care, but those who do are positive
        if (position < 0.40) value = 1;
        else if (position < 0.50) value = -1;
        break;
    }

    if (value !== null) {
      votes.push({ proposalId, userId: voterIds[i], value });
    }
  }

  return votes;
}

// Map proposal titles to voting patterns — makes the data feel realistic
const PROPOSAL_PATTERNS: Record<string, VotePattern> = {
  // Q2 Roadmap
  "Prioritize Mobile App Redesign": "popular",
  "Launch API v2 First": "polarizing",
  "Analytics Dashboard MVP": "popular",
  "Technical Debt Sprint": "lukewarm",
  "Combine Mobile + API Into One Initiative": "controversial",

  // Office Relocation
  "Move to Pipera Business District": "polarizing",
  "Stay and Renovate Current Office": "controversial",
  "Go Fully Remote": "popular",
  "Hybrid Hub in Both Bucharest and Cluj": "lukewarm",

  // Team Retreat
  "Vama Veche Beach Retreat": "popular",
  "Brasov Adventure Retreat": "polarizing",
  "Budapest Long Weekend": "controversial",
  "Villa Retreat in Maramures": "niche",
  "Skip the Retreat, Redistribute Budget": "lukewarm",

  // K8s Migration
  "Full Migration to Managed Kubernetes (GKE)": "polarizing",
  "Incremental Docker Compose + Traefik": "popular",
  "Move to Railway or Fly.io (PaaS)": "lukewarm",
  "Kubernetes but Self-Hosted on Hetzner": "niche",

  // Customer Onboarding
  "Simplify to 3 Steps (Sign Up, Create Workspace, Invite)": "popular",
  "Interactive Product Tour with Tooltips": "polarizing",
  "Template-Based Quick Start": "popular",

  // Budget
  "Engineering 45% / Marketing 25% / HR 20% / Security 10%": "lukewarm",
  "Engineering 55% / Marketing 20% / HR 15% / Security 10%": "controversial",
  "Equal Distribution with Performance Milestones": "popular",
  "Defer Marketing Spend, Front-Load Security": "polarizing",

  // Remote Work
  "3 Days Remote, 2 Days In-Office (Tuesday/Thursday)": "popular",
  "Fully Flexible with Team-Level Agreements": "popular",
  "Office-First with Remote Fridays": "controversial",
  "Async-First, Location-Independent": "niche",

  // Hackathon
  "Fund the AI Customer Support Bot": "popular",
  "Invest in the Tech Debt Tracker": "lukewarm",
  "Fund Both, Smaller Scope": "popular",
};

/**
 * Create votes for a set of proposals.
 * Shuffles voter order per proposal so the same users don't always vote the same way.
 * @param proposalIds Map of proposal ID → proposal title
 * @param voterIds All user IDs eligible to vote
 */
export function createVotes(
  proposalIds: Map<string, string>,
  voterIds: string[],
): DemoVote[] {
  const allVotes: DemoVote[] = [];

  for (const [proposalId, title] of proposalIds) {
    const pattern = PROPOSAL_PATTERNS[title] ?? "lukewarm";
    // Shuffle voters for each proposal so patterns aren't identical
    const shuffled = [...voterIds].sort(() => Math.random() - 0.5);
    const votes = applyPattern(proposalId, shuffled, pattern);
    allVotes.push(...votes);
  }

  return allVotes;
}

/**
 * Get available vote patterns for testing.
 */
export function getVotePatterns(): string[] {
  return ["popular", "controversial", "polarizing", "lukewarm", "niche"];
}
