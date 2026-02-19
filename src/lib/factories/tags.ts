import { randomUUID } from "crypto";

export interface DemoTag {
  id: string;
  name: string;
}

const TAG_NAMES = [
  // Priority
  "high-priority",
  "urgent",
  "low-priority",

  // Category
  "budget",
  "infrastructure",
  "people",
  "tech",
  "process",
  "strategy",

  // Timeline
  "long-term",
  "quick-win",
  "q2-2026",
  "h2-2026",

  // Department
  "engineering",
  "marketing",
  "hr",
  "security",
  "product",
  "design",

  // Status/Type
  "needs-research",
  "cost-analysis",
  "team-decision",
  "executive-review",
];

// Maps project title prefix → tag names to assign
const PROJECT_TAG_MAP: Record<string, string[]> = {
  "Q2 Product Roadmap": ["high-priority", "product", "engineering", "q2-2026", "strategy"],
  "Office Relocation": ["urgent", "budget", "people", "infrastructure", "cost-analysis"],
  "Annual Team Retreat": ["people", "budget", "team-decision", "h2-2026"],
  "Tech Stack Migration": ["tech", "infrastructure", "engineering", "long-term", "needs-research"],
  "Customer Onboarding": ["high-priority", "product", "design", "quick-win"],
  "Budget Allocation": ["budget", "strategy", "executive-review", "h2-2026"],
  "Remote Work Policy": ["people", "process", "urgent", "team-decision"],
  "Hackathon Results": ["tech", "engineering", "quick-win"],
};

// Maps proposal title → tag names to assign
const PROPOSAL_TAG_MAP: Record<string, string[]> = {
  "Prioritize Mobile App Redesign": ["product", "engineering", "high-priority"],
  "Launch API v2 First": ["tech", "engineering", "urgent"],
  "Analytics Dashboard MVP": ["product", "quick-win"],
  "Technical Debt Sprint": ["tech", "engineering", "needs-research"],
  "Move to Pipera Business District": ["budget", "cost-analysis"],
  "Go Fully Remote": ["people", "strategy", "long-term"],
  "Full Migration to Managed Kubernetes (GKE)": ["infrastructure", "budget", "long-term"],
  "Incremental Docker Compose + Traefik": ["infrastructure", "quick-win"],
  "Simplify to 3 Steps (Sign Up, Create Workspace, Invite)": ["product", "design", "quick-win"],
  "Equal Distribution with Performance Milestones": ["budget", "strategy"],
  "3 Days Remote, 2 Days In-Office (Tuesday/Thursday)": ["people", "process"],
  "Fund the AI Customer Support Bot": ["tech", "product", "high-priority"],
};

/**
 * Create the full set of demo tags.
 */
export function createTags(): DemoTag[] {
  return TAG_NAMES.map((name) => ({ id: randomUUID(), name }));
}

/**
 * Get project-tag associations.
 * @param projectTitle The project title
 * @param tagMap Map of tag name → tag ID (from created tags)
 * @returns Array of tag names for this project
 */
export function getProjectTagNames(projectTitle: string): string[] {
  const matchKey = Object.keys(PROJECT_TAG_MAP).find((key) =>
    projectTitle.startsWith(key),
  );
  return matchKey ? PROJECT_TAG_MAP[matchKey] : [];
}

/**
 * Get proposal-tag associations.
 * @param proposalTitle The proposal title
 * @returns Array of tag names for this proposal
 */
export function getProposalTagNames(proposalTitle: string): string[] {
  return PROPOSAL_TAG_MAP[proposalTitle] ?? [];
}

export function getTagCount(): number {
  return TAG_NAMES.length;
}
