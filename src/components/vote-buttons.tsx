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
    startTransition(async () => {
      setOptimistic(value);
      const token = getCsrfTokenClient();
      const result =
        userVote === value
          ? await removeVote(proposalId, projectId, token)
          : await castVote(proposalId, value, projectId, token);
      if (result?.error) {
        toast.error(result.error);
      }
    });
  }

  const upTitle = optimistic.userVote === 1 ? t("vote.remove") : t("vote.pro");
  const downTitle = optimistic.userVote === -1 ? t("vote.remove") : t("vote.contra");

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Vote on this proposal">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleVote(1)}
        disabled={isPending}
        title={upTitle}
        aria-label={`${t("vote.pro")} (${optimistic.upvotes})${optimistic.userVote === 1 ? " - " + t("vote.remove") : ""}`}
        aria-pressed={optimistic.userVote === 1}
        className={cn(
          "min-h-[44px] transition-all duration-150 active:scale-95",
          optimistic.userVote === 1
            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-900/70"
            : "text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
        )}
      >
        {isPending ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <ThumbsUp
            className="mr-1 h-4 w-4"
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
          "min-h-[44px] transition-all duration-150 active:scale-95",
          optimistic.userVote === -1
            ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900/70"
            : "text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
        )}
      >
        {isPending ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <ThumbsDown
            className="mr-1 h-4 w-4"
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
