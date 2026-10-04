"use client";

import { useOptimistic, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { castVote, removeVote } from "@/app/projects/[id]/proposals/actions";
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";
import { getCsrfTokenClient } from "@/lib/csrf-client";

interface VoteButtonsProps {
  proposalId: string;
  projectId: string;
  upvotes: number;
  downvotes: number;
  userVote: number | null;
  /** When set, clicking a vote button redirects an unauthenticated user to login instead of calling the action. */
  guestRedirect?: string;
  readOnly?: boolean;
}

interface VoteState {
  upvotes: number;
  downvotes: number;
  userVote: number | null;
}

/**
 * Thumbs up/down vote buttons with optimistic UI updates,
 * filled icons when voted, and "click again to remove" tooltip.
 */
export function VoteButtons({
  proposalId,
  projectId,
  upvotes,
  downvotes,
  userVote,
  guestRedirect,
  readOnly = false,
}: VoteButtonsProps) {
  const [isPending, startTransition] = useTransition();
  const { t } = useLocale();

  const [optimistic, setOptimistic] = useOptimistic<VoteState, number>(
    { upvotes, downvotes, userVote },
    (state, votedValue) => {
      const isRemoving = state.userVote === votedValue;
      if (isRemoving) {
        return {
          upvotes: state.upvotes - (state.userVote === 1 ? 1 : 0),
          downvotes: state.downvotes - (state.userVote === -1 ? 1 : 0),
          userVote: null,
        };
      }
      // Switching or new vote
      return {
        upvotes: state.upvotes + (votedValue === 1 ? 1 : 0) - (state.userVote === 1 ? 1 : 0),
        downvotes: state.downvotes + (votedValue === -1 ? 1 : 0) - (state.userVote === -1 ? 1 : 0),
        userVote: votedValue,
      };
    },
  );

  function handleVote(value: number) {
    if (guestRedirect) {
      window.location.href = `/auth/login?redirect=${encodeURIComponent(guestRedirect)}`;
      return;
    }
    startTransition(async () => {
      setOptimistic(value);
      const token = getCsrfTokenClient();
      const result =
        userVote === value
          ? await removeVote(proposalId, projectId, token)
          : await castVote(proposalId, value, projectId, token);
      if (result?.error) {
        toast.error(t(result.error));
      }
    });
  }

  const upTitle = optimistic.userVote === 1 ? t("vote.remove") : t("vote.pro");
  const downTitle = optimistic.userVote === -1 ? t("vote.remove") : t("vote.contra");

  if (readOnly) {
    return <div className="flex min-h-11 items-center gap-3 text-xs text-muted-foreground" aria-label={t("vote.ariaGroup")}>
      <span className="inline-flex items-center gap-1" aria-label={`${t("vote.pro")} (${upvotes})`}><ThumbsUp className="size-4" />{upvotes}</span>
      <span className="inline-flex items-center gap-1" aria-label={`${t("vote.contra")} (${downvotes})`}><ThumbsDown className="size-4" />{downvotes}</span>
    </div>;
  }

  return (
    <div className="flex items-center gap-0 sm:gap-1" role="group" aria-label={t("vote.ariaGroup")}>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {t("vote.pro")} {optimistic.upvotes}, {t("vote.contra")} {optimistic.downvotes}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleVote(1)}
        disabled={isPending}
        title={upTitle}
        aria-label={`${t("vote.pro")} (${optimistic.upvotes})${optimistic.userVote === 1 ? " - " + t("vote.remove") : ""}`}
        aria-pressed={optimistic.userVote === 1}
        className={cn(
          "min-h-11 min-w-11 gap-1 px-1 has-[>svg]:px-1 sm:gap-1.5 sm:px-3 sm:has-[>svg]:px-2.5 transition-all duration-150 active:scale-95",
          optimistic.userVote === 1
            ? "bg-vote-pro text-vote-pro-foreground hover:bg-vote-pro hover:text-vote-pro-foreground dark:hover:bg-vote-pro"
            : "text-muted-foreground hover:bg-vote-pro hover:text-vote-pro-foreground dark:hover:bg-vote-pro"
        )}
      >
        {isPending ? (
          <Loader2 className="sm:mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <ThumbsUp
            className="sm:mr-1 h-4 w-4"
            aria-hidden="true"
            fill={optimistic.userVote === 1 ? "currentColor" : "none"}
          />
        )}
        <span className="text-sm font-medium">{optimistic.upvotes}</span>
        {isPending && <span className="sr-only">{t("vote.loading")}</span>}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleVote(-1)}
        disabled={isPending}
        title={downTitle}
        aria-label={`${t("vote.contra")} (${optimistic.downvotes})${optimistic.userVote === -1 ? " - " + t("vote.remove") : ""}`}
        aria-pressed={optimistic.userVote === -1}
        className={cn(
          "min-h-11 min-w-11 gap-1 px-1 has-[>svg]:px-1 sm:gap-1.5 sm:px-3 sm:has-[>svg]:px-2.5 transition-all duration-150 active:scale-95",
          optimistic.userVote === -1
            ? "bg-vote-contra text-vote-contra-foreground hover:bg-vote-contra hover:text-vote-contra-foreground dark:hover:bg-vote-contra"
            : "text-muted-foreground hover:bg-vote-contra hover:text-vote-contra-foreground dark:hover:bg-vote-contra"
        )}
      >
        {isPending ? (
          <Loader2 className="sm:mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <ThumbsDown
            className="sm:mr-1 h-4 w-4"
            aria-hidden="true"
            fill={optimistic.userVote === -1 ? "currentColor" : "none"}
          />
        )}
        <span className="text-sm font-medium">{optimistic.downvotes}</span>
        {isPending && <span className="sr-only">{t("vote.loading")}</span>}
      </Button>
    </div>
  );
}
