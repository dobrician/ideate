// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ── Mocks ──────────────────────────────────────────────────────

vi.mock("@/lib/use-locale", () => ({
  useLocale: () => ({
    locale: "en",
    t: (key: string) => {
      const map: Record<string, string> = {
        "vote.pro": "Pro",
        "vote.contra": "Contra",
        "vote.remove": "Remove vote",
      };
      return map[key] ?? key;
    },
  }),
}));

const mockCastVote = vi.fn(async () => ({ success: true }));
const mockRemoveVote = vi.fn(async () => ({ success: true }));

vi.mock("@/app/projects/[id]/proposals/actions", () => ({
  castVote: (...args: unknown[]) => mockCastVote(...args),
  removeVote: (...args: unknown[]) => mockRemoveVote(...args),
}));

vi.mock("@/lib/csrf-client", () => ({
  getCsrfTokenClient: () => "mock-csrf",
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// ── Import after mocks ─────────────────────────────────────────

import { VoteButtons } from "@/components/vote-buttons";

// ── Tests ───────────────────────────────────────────────────────

describe("VoteButtons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders upvote and downvote counts", () => {
    render(
      <VoteButtons proposalId="p1" projectId="proj1" upvotes={7} downvotes={3} userVote={null} />
    );
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("has correct aria-pressed when user has upvoted", () => {
    render(
      <VoteButtons proposalId="p1" projectId="proj1" upvotes={5} downvotes={2} userVote={1} />
    );
    const upBtn = screen.getByRole("button", { name: /Pro.*5/i });
    const downBtn = screen.getByRole("button", { name: /Contra.*2/i });
    expect(upBtn).toHaveAttribute("aria-pressed", "true");
    expect(downBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("has correct aria-pressed when user has downvoted", () => {
    render(
      <VoteButtons proposalId="p1" projectId="proj1" upvotes={5} downvotes={2} userVote={-1} />
    );
    const upBtn = screen.getByRole("button", { name: /Pro.*5/i });
    const downBtn = screen.getByRole("button", { name: /Contra.*2/i });
    expect(upBtn).toHaveAttribute("aria-pressed", "false");
    expect(downBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("shows no active state when user has not voted", () => {
    render(
      <VoteButtons proposalId="p1" projectId="proj1" upvotes={0} downvotes={0} userVote={null} />
    );
    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => expect(btn).toHaveAttribute("aria-pressed", "false"));
  });

  it("shows 'Remove vote' in title when user already upvoted", () => {
    render(
      <VoteButtons proposalId="p1" projectId="proj1" upvotes={1} downvotes={0} userVote={1} />
    );
    const upBtn = screen.getByRole("button", { name: /Pro/i });
    expect(upBtn).toHaveAttribute("title", "Remove vote");
  });

  it("shows 'Remove vote' in title when user already downvoted", () => {
    render(
      <VoteButtons proposalId="p1" projectId="proj1" upvotes={0} downvotes={1} userVote={-1} />
    );
    const downBtn = screen.getByRole("button", { name: /Contra/i });
    expect(downBtn).toHaveAttribute("title", "Remove vote");
  });

  it("calls castVote when clicking upvote with no existing vote", async () => {
    const user = userEvent.setup();
    render(
      <VoteButtons proposalId="p1" projectId="proj1" upvotes={0} downvotes={0} userVote={null} />
    );
    const upBtn = screen.getByRole("button", { name: /Pro/i });
    await user.click(upBtn);
    expect(mockCastVote).toHaveBeenCalledWith("p1", 1, "proj1", "mock-csrf");
  });

  it("calls removeVote when clicking upvote again (toggle off)", async () => {
    const user = userEvent.setup();
    render(
      <VoteButtons proposalId="p1" projectId="proj1" upvotes={1} downvotes={0} userVote={1} />
    );
    const upBtn = screen.getByRole("button", { name: /Pro/i });
    await user.click(upBtn);
    expect(mockRemoveVote).toHaveBeenCalledWith("p1", "proj1", "mock-csrf");
  });

  it("calls castVote for downvote", async () => {
    const user = userEvent.setup();
    render(
      <VoteButtons proposalId="p1" projectId="proj1" upvotes={0} downvotes={0} userVote={null} />
    );
    const downBtn = screen.getByRole("button", { name: /Contra/i });
    await user.click(downBtn);
    expect(mockCastVote).toHaveBeenCalledWith("p1", -1, "proj1", "mock-csrf");
  });

  it("wraps buttons in a group with correct aria-label", () => {
    render(
      <VoteButtons proposalId="p1" projectId="proj1" upvotes={0} downvotes={0} userVote={null} />
    );
    expect(screen.getByRole("group")).toHaveAttribute("aria-label", "Vote on this proposal");
  });
});
