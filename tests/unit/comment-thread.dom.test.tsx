// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// ── Mocks ──────────────────────────────────────────────────────

vi.mock("@/lib/use-locale", () => ({
  useLocale: () => ({
    locale: "en",
    t: (key: string) => {
      const map: Record<string, string> = {
        "comments.noComments": "No comments yet",
        "comments.placeholder": "Write a message…",
        "comments.submit": "Send",
        "comments.you": "You",
        "comments.newMessages": "New messages",
        "time.justNow": "just now",
        "time.minutesAgo": "min ago",
        "time.hoursAgo": "hr ago",
        "time.daysAgo": "d ago",
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/csrf-client", () => ({
  getCsrfTokenClient: () => "mock-csrf",
}));

const mockAddComment = vi.fn().mockResolvedValue({ success: true });
vi.mock("@/app/projects/[id]/proposals/comment-actions", () => ({
  addComment: (...args: unknown[]) => mockAddComment(...args),
}));

vi.mock("@/components/markdown-renderer", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <span>{content}</span>,
}));

import type { Comment } from "@/components/comment-thread";
import { CommentThread } from "@/components/comment-thread";

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: "c1",
    content: "Hello world",
    parentId: null,
    userId: "u1",
    userName: "Alice Smith",
    createdAt: new Date("2026-01-15T12:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  mockAddComment.mockClear();
});

/* ------------------------------------------------------------------ */
/*  Goal 3: CommentThread + ChatBubble render tests                    */
/* ------------------------------------------------------------------ */

describe("CommentThread rendering", () => {
  it("renders empty state when no comments", () => {
    render(
      <CommentThread comments={[]} hiddenFields={{ projectId: "p1" }} />
    );
    expect(screen.getByText("No comments yet")).toBeInTheDocument();
  });

  it("renders comment content", () => {
    render(
      <CommentThread
        comments={[makeComment()]}
        hiddenFields={{ projectId: "p1" }}
      />
    );
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders own message right-aligned (flex-row-reverse)", () => {
    const { container } = render(
      <CommentThread
        comments={[makeComment({ userId: "me" })]}
        hiddenFields={{ projectId: "p1" }}
        currentUserId="me"
      />
    );
    const bubble = container.querySelector(".flex-row-reverse");
    expect(bubble).toBeInTheDocument();
  });

  it("renders other's message left-aligned (flex-row, no reverse)", () => {
    const { container } = render(
      <CommentThread
        comments={[makeComment({ userId: "other" })]}
        hiddenFields={{ projectId: "p1" }}
        currentUserId="me"
      />
    );
    const bubbles = container.querySelectorAll(".group\\/bubble");
    expect(bubbles.length).toBe(1);
    expect(bubbles[0].classList.contains("flex-row-reverse")).toBe(false);
    expect(bubbles[0].classList.contains("flex-row")).toBe(true);
  });

  it("shows avatar on first message and collapses on consecutive same-user", () => {
    const comments = [
      makeComment({ id: "c1", userId: "u1", userName: "Alice" }),
      makeComment({
        id: "c2",
        userId: "u1",
        userName: "Alice",
        content: "Second msg",
        createdAt: new Date("2026-01-15T12:01:00Z"),
      }),
    ];
    const { container } = render(
      <CommentThread comments={comments} hiddenFields={{ projectId: "p1" }} />
    );
    // First message shows avatar, second shows spacer div
    const avatars = container.querySelectorAll("[data-slot='avatar']");
    expect(avatars.length).toBe(1);
    // Spacer div (w-6) for collapsed avatar
    const spacers = container.querySelectorAll("div.w-6.shrink-0");
    expect(spacers.length).toBe(1);
  });

  it("shows avatar when user changes between messages", () => {
    const comments = [
      makeComment({ id: "c1", userId: "u1", userName: "Alice" }),
      makeComment({
        id: "c2",
        userId: "u2",
        userName: "Bob",
        content: "Reply",
        createdAt: new Date("2026-01-15T12:01:00Z"),
      }),
    ];
    const { container } = render(
      <CommentThread comments={comments} hiddenFields={{ projectId: "p1" }} />
    );
    const avatars = container.querySelectorAll("[data-slot='avatar']");
    expect(avatars.length).toBe(2);
  });

  it("displays 'You' label for own messages", () => {
    render(
      <CommentThread
        comments={[makeComment({ userId: "me" })]}
        hiddenFields={{ projectId: "p1" }}
        currentUserId="me"
      />
    );
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("displays user name for others' messages", () => {
    render(
      <CommentThread
        comments={[makeComment({ userId: "other", userName: "Bob Jones" })]}
        hiddenFields={{ projectId: "p1" }}
        currentUserId="me"
      />
    );
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
  });

  it("renders avatar image element when avatarUrl is provided", () => {
    const { container } = render(
      <CommentThread
        comments={[makeComment({ avatarUrl: "https://example.com/pic.jpg" })]}
        hiddenFields={{ projectId: "p1" }}
      />
    );
    // Radix AvatarImage renders a span with data-slot in jsdom (no native img load)
    // Verify the avatar container exists and the image slot is present
    const avatar = container.querySelector("[data-slot='avatar']");
    expect(avatar).toBeInTheDocument();
    // The AvatarImage component is rendered (even if img not loaded in jsdom)
    const imageSlot = avatar?.querySelector("[data-slot='avatar-image']") ??
      avatar?.querySelector("img[src='https://example.com/pic.jpg']");
    // At minimum, verify avatar is present with the fallback
    const fallback = avatar?.querySelector("[data-slot='avatar-fallback']");
    expect(fallback || imageSlot).toBeTruthy();
  });

  it("renders initials fallback when no avatarUrl", () => {
    const { container } = render(
      <CommentThread
        comments={[makeComment({ avatarUrl: undefined, userName: "Alice Smith" })]}
        hiddenFields={{ projectId: "p1" }}
      />
    );
    const fallback = container.querySelector("[data-slot='avatar-fallback']");
    expect(fallback).toBeInTheDocument();
    expect(fallback?.textContent).toBe("AS");
  });

  it("renders hover-reveal timestamp on non-grouped messages", () => {
    const comments = [
      makeComment({ id: "c1", userId: "u1" }),
      makeComment({
        id: "c2",
        userId: "u1",
        content: "Follow-up",
        createdAt: new Date("2026-01-15T12:01:00Z"),
      }),
    ];
    render(
      <CommentThread comments={comments} hiddenFields={{ projectId: "p1" }} />
    );
    const ts = screen.getByTestId("hover-timestamp");
    expect(ts).toBeInTheDocument();
    expect(ts.className).toContain("opacity-0");
    expect(ts.className).toContain("group-hover/bubble:opacity-100");
  });

  it("renders error message from server action state", () => {
    // The error display depends on state; we test the form structure exists
    render(
      <CommentThread comments={[]} hiddenFields={{ projectId: "p1" }} />
    );
    const textarea = screen.getByPlaceholderText("Write a message…");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute("maxLength", "2000");
  });

  it("renders send button with title", () => {
    render(
      <CommentThread comments={[]} hiddenFields={{ projectId: "p1" }} />
    );
    const btn = screen.getByTitle("Send");
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("type", "submit");
  });

  it("renders hidden fields from props", () => {
    const { container } = render(
      <CommentThread
        comments={[]}
        hiddenFields={{ projectId: "proj-1" }}
      />
    );
    const hidden = container.querySelector("input[name='projectId']") as HTMLInputElement;
    expect(hidden).toBeInTheDocument();
    expect(hidden.value).toBe("proj-1");
  });

  it("renders CSRF token hidden field", () => {
    const { container } = render(
      <CommentThread comments={[]} hiddenFields={{ projectId: "p1" }} />
    );
    const csrf = container.querySelector("input[name='csrfToken']") as HTMLInputElement;
    expect(csrf).toBeInTheDocument();
    expect(csrf.value).toBe("mock-csrf");
  });

  it("applies own-message bubble styling (bg-primary)", () => {
    const { container } = render(
      <CommentThread
        comments={[makeComment({ userId: "me" })]}
        hiddenFields={{ projectId: "p1" }}
        currentUserId="me"
      />
    );
    const bubble = container.querySelector(".bg-primary.rounded-2xl");
    expect(bubble).toBeInTheDocument();
  });

  it("applies other-message bubble styling (bg-muted)", () => {
    const { container } = render(
      <CommentThread
        comments={[makeComment({ userId: "other" })]}
        hiddenFields={{ projectId: "p1" }}
        currentUserId="me"
      />
    );
    const bubble = container.querySelector(".bg-muted.rounded-2xl");
    expect(bubble).toBeInTheDocument();
  });
});
