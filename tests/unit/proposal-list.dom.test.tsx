// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// ── Mocks ──────────────────────────────────────────────────────

vi.mock("@/lib/use-locale", () => ({
  useLocale: () => ({
    locale: "en",
    t: (key: string) => {
      const map: Record<string, string> = {
        "proposals.noProposals": "No proposals yet. Be the first to submit one!",
        "proposals.by": "by",
        "proposals.details": "Details",
        "proposals.delete": "Delete",
        "proposals.deleteConfirm": "Delete this proposal?",
        "proposals.deleted": "Proposal deleted",
        "proposals.showSummary": "Show summary",
        "proposals.showFull": "Show full description",
        "vote.pro": "Pro",
        "vote.contra": "Contra",
        "vote.remove": "Remove vote",
        "vote.noVotes": "No votes yet",
        "vote.approvalRatio": "Approval ratio",
        "common.cancel": "Cancel",
        "common.delete": "Delete",
        "deleteProject.deleting": "Deleting...",
        "comments.open": "Open discussion",
        "comments.title": "Discussion",
        "comments.discussionTitle": "Discussion: {title}",
        "comments.placeholder": "Add a comment...",
        "comments.noComments": "No comments yet.",
        "comments.submit": "Post Comment",
        "comments.posting": "Posting...",
        "comments.reply": "Reply",
        "comments.replyPlaceholder": "Write a reply...",
        "comments.replyPosted": "Reply posted",
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock("@/lib/use-vote-stream", () => ({
  useVoteStream: () => new Map(),
}));

vi.mock("@/app/projects/[id]/proposals/actions", () => ({
  deleteProposal: vi.fn(async () => ({ success: true })),
  castVote: vi.fn(async () => ({ success: true })),
  removeVote: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/app/projects/[id]/proposals/comment-actions", () => ({
  addComment: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/lib/csrf-client", () => ({
  getCsrfTokenClient: () => "mock-csrf",
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

// ── Import after mocks ─────────────────────────────────────────

import { ProposalList } from "@/components/proposal-list";

function makeProposal(overrides: Partial<{
  id: string;
  title: string;
  description: string | null;
  summary: string | null;
  userId: string | null;
  createdAt: Date | null;
  upvotes: number;
  downvotes: number;
  userVote: number | null;
  commentCount: number;
  comments: [];
  authorName: string;
  attachments: { id: string; filename: string; mimeType: string; size: number }[];
}> = {}) {
  return {
    id: overrides.id ?? "p1",
    title: overrides.title ?? "Proposal A",
    description: overrides.description ?? "Description A",
    summary: overrides.summary ?? null,
    userId: overrides.userId ?? "u1",
    createdAt: overrides.createdAt ?? new Date("2025-01-01"),
    upvotes: overrides.upvotes ?? 0,
    downvotes: overrides.downvotes ?? 0,
    userVote: overrides.userVote ?? null,
    commentCount: overrides.commentCount ?? 0,
    comments: overrides.comments ?? [],
    authorName: overrides.authorName ?? "Test Author",
    attachments: overrides.attachments ?? [],
  };
}

// ── Tests ───────────────────────────────────────────────────────

describe("ProposalList", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders empty state when no proposals", () => {
    render(
      <ProposalList proposals={[]} projectId="proj1" currentUserId="u1" isAdmin={false} />
    );
    expect(screen.getByText(/No proposals yet/)).toBeInTheDocument();
  });

  it("renders proposal titles", () => {
    const proposals = [
      makeProposal({ id: "p1", title: "Feature X" }),
      makeProposal({ id: "p2", title: "Feature Y" }),
    ];
    render(
      <ProposalList proposals={proposals} projectId="proj1" currentUserId="u1" isAdmin={false} />
    );
    expect(screen.getByText("Feature X")).toBeInTheDocument();
    expect(screen.getByText("Feature Y")).toBeInTheDocument();
  });

  it("sorts proposals by net votes (highest first), tie-break by newest first", () => {
    const proposals = [
      makeProposal({ id: "low", title: "Low Priority", upvotes: 1, downvotes: 3, createdAt: new Date("2025-01-01") }),
      makeProposal({ id: "high", title: "High Priority", upvotes: 10, downvotes: 0, createdAt: new Date("2025-01-02") }),
      makeProposal({ id: "mid", title: "Mid Priority", upvotes: 5, downvotes: 2, createdAt: new Date("2025-01-03") }),
      makeProposal({ id: "tie-old", title: "Tie Older", upvotes: 3, downvotes: 1, createdAt: new Date("2025-01-04") }),
      makeProposal({ id: "tie-new", title: "Tie Newer", upvotes: 5, downvotes: 3, createdAt: new Date("2025-01-10") }),
    ];
    render(
      <ProposalList proposals={proposals} projectId="proj1" currentUserId="u1" isAdmin={false} />
    );
    const titles = screen.getAllByText(/Priority|Tie/).map((el) => el.textContent);
    // net: High=10, Mid=3, Tie Older=2, Tie Newer=2, Low=-2
    // Tie-break (net=2): Newer (Jan 10) before Older (Jan 4)
    expect(titles).toEqual([
      "High Priority",
      "Mid Priority",
      "Tie Newer",
      "Tie Older",
      "Low Priority",
    ]);
  });

  it("scales bar chart width proportionally to max total votes", () => {
    const proposals = [
      makeProposal({ id: "a", title: "A", upvotes: 3, downvotes: 2 }),
      makeProposal({ id: "b", title: "B", upvotes: 2, downvotes: 1 }),
      makeProposal({ id: "c", title: "C", upvotes: 0, downvotes: 1 }),
    ];
    const { container } = render(
      <ProposalList proposals={proposals} projectId="proj1" currentUserId="u1" isAdmin={false} />
    );
    // Bar container has aria-hidden="true"; individual fills have style widths
    const barContainers = container.querySelectorAll('[aria-hidden="true"]');
    const widths: string[] = [];
    barContainers.forEach((c) => {
      c.querySelectorAll("[style]").forEach((el) => {
        widths.push((el as HTMLElement).style.width);
      });
    });
    // Vote bar uses maxTotalVotes scaling (max = 5 from proposal A: 3+2)
    // A: green=3/5*100=60%, red=2/5*100=40%
    // B: green=2/5*100=40%, red=1/5*100=20%
    // C: green not rendered, red=1/5*100=20%
    expect(widths).toContain("60%");
    expect(widths).toContain("40%");
    expect(widths).toContain("20%");
    // No 0% width bar should be rendered
    expect(widths).not.toContain("0%");
  });

  it("shows author name for each proposal", () => {
    const proposals = [
      makeProposal({ id: "p1", title: "X", authorName: "Alice" }),
    ];
    const { container } = render(
      <ProposalList proposals={proposals} projectId="proj1" currentUserId="u1" isAdmin={false} />
    );
    expect(container.textContent).toContain("Alice");
  });
});
