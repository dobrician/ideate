"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { castVote, removeVote } from "@/app/projects/[id]/proposals/actions";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";

interface VoteButtonsProps {
  proposalId: string;
  projectId: string;
  upvotes: number;
  downvotes: number;
  userVote: number | null;
}

/**
 * Thumbs up/down vote buttons with filled icons when voted,
 * background highlight, and "click again to remove" tooltip
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

  function handleVote(value: number) {
    startTransition(async () => {
      const result =
        userVote === value
          ? await removeVote(proposalId, projectId)
          : await castVote(proposalId, value, projectId);
      if (result?.error) {
        toast.error(result.error);
      }
    });
  }

  const upTitle = userVote === 1 ? t("vote.remove") : t("vote.pro");
  const downTitle = userVote === -1 ? t("vote.remove") : t("vote.contra");

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Vote on this proposal">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleVote(1)}
        disabled={isPending}
        title={upTitle}
        aria-label={`${t("vote.pro")} (${upvotes})${userVote === 1 ? " - " + t("vote.remove") : ""}`}
        aria-pressed={userVote === 1}
        className={cn(
          "transition-colors duration-150",
          userVote === 1
            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-900/70"
            : "text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
        )}
      >
        <ThumbsUp
          className="mr-1 h-4 w-4"
          aria-hidden="true"
          fill={userVote === 1 ? "currentColor" : "none"}
        />
        <span className="text-sm font-medium">{upvotes}</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleVote(-1)}
        disabled={isPending}
        title={downTitle}
        aria-label={`${t("vote.contra")} (${downvotes})${userVote === -1 ? " - " + t("vote.remove") : ""}`}
        aria-pressed={userVote === -1}
        className={cn(
          "transition-colors duration-150",
          userVote === -1
            ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900/70"
            : "text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
        )}
      >
        <ThumbsDown
          className="mr-1 h-4 w-4"
          aria-hidden="true"
          fill={userVote === -1 ? "currentColor" : "none"}
        />
        <span className="text-sm font-medium">{downvotes}</span>
      </Button>
    </div>
  );
}
