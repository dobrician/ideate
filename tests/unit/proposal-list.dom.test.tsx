// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  tags: { id: string; name: string }[];
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
    tags: overrides.tags ?? [],
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

  it("should place the author below the compact header when expanded", async () => {
    const user = userEvent.setup();
    const proposals = [
      makeProposal({ id: "p1", title: "X", authorName: "Alice" }),
    ];
    const { container } = render(
      <ProposalList proposals={proposals} projectId="proj1" currentUserId="u1" isAdmin={false} />
    );
    const author = container.querySelector('[data-proposal-author]');
    expect(author).toHaveTextContent("Alice");
    expect(container.querySelector('[data-proposal-header]')?.contains(author)).toBe(false);
    await user.click(screen.getByRole("button", { name: /X/ }));
    expect(author?.closest('[data-slot="accordion-item"]')).toHaveAttribute("data-state", "open");
  });

  it("should use decorative card backgrounds and leave unvoted ideas unfilled", () => {
    const { container } = render(<ProposalList proposals={[makeProposal()]} projectId="proj1" currentUserId="u1" isAdmin={false} />);
    const chart = container.querySelector('[data-vote-chart]');
    expect(chart).toHaveAttribute("aria-hidden", "true");
    expect(chart?.children).toHaveLength(0);
    expect(container.querySelector('.h-1')).toBeNull();
  });

  it("should show the first preview and reveal the original description on demand", async () => {
    const user = userEvent.setup();
    render(<ProposalList proposals={[makeProposal({ summary: "A concise decision summary.", description: "Original detailed proposal." })]}
      projectId="proj1" currentUserId="u1" isAdmin={false} />);
    // jsdom does not load Tailwind; hover visibility is verified in the browser suite.
    expect(screen.getByText("A concise decision summary.")).toBeInTheDocument();
    expect(screen.queryByText("Original detailed proposal.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Proposal A/ }));
    expect(screen.getByText("Original detailed proposal.")).toBeVisible();
  });

  it("should keep voting and discussion buttons outside the details trigger", () => {
    const { container } = render(<ProposalList proposals={[makeProposal()]} projectId="proj1" currentUserId="u1" isAdmin={false} />);
    expect(container.querySelector("button button")).toBeNull();
    expect(screen.getByRole("button", { name: "Pro (0)" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Contra (0)" })).toBeVisible();
  });

  it.each(["newest", "oldest", "comments", "controversy"] as const)("should preserve the server ordering when %s is selected", sort => {
    const proposals = [makeProposal({ id: "low", title: "First idea", upvotes: 1 }), makeProposal({ id: "high", title: "Second idea", upvotes: 10 })];
    render(<ProposalList proposals={proposals} projectId="proj1" currentUserId="u1" isAdmin={false} sort={sort} />);
    expect(screen.getAllByText(/First idea|Second idea/).map(el => el.textContent)).toEqual(["First idea", "Second idea"]);
  });
});


describe("ProposalList inactive projects", () => {
  it("should show vote totals without vote, discussion or delete buttons", async () => {
    const user = userEvent.setup();
    render(<ProposalList proposals={[makeProposal({ upvotes: 11, downvotes: 2 })]} projectId="proj1" currentUserId="u1" isAdmin readOnly />);
    expect(screen.getByLabelText("Pro (11)")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Pro (11)" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Open discussion" })).toBeNull();
    await user.click(screen.getByRole("button", { name: /Proposal A/ }));
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });
});


describe("ProposalList persistent preview", () => {
  it("should activate the first idea and keep a focused selection after leaving", () => {
    const { container } = render(<ProposalList proposals={[makeProposal({ id: "first", title: "First", upvotes: 2 }), makeProposal({ id: "second", title: "Second" })]} projectId="proj1" currentUserId="u1" isAdmin={false} />);
    const cards = container.querySelectorAll('[data-slot="accordion-item"]');
    expect(cards[0]).toHaveAttribute("data-preview-active", "true");
    expect(cards[1]).toHaveAttribute("data-preview-active", "false");
    fireEvent.focus(screen.getByRole("button", { name: /Second/ }));
    expect(cards[1]).toHaveAttribute("data-preview-active", "true");
    fireEvent.blur(screen.getByRole("button", { name: /Second/ }));
    expect(cards[1]).toHaveAttribute("data-preview-active", "true");
    expect(cards[0]).toHaveAttribute("data-preview-active", "false");
  });
});
