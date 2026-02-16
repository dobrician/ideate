"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { castVote, removeVote } from "@/app/projects/[id]/proposals/actions";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";

interface VoteButtonsProps {
  proposalId: string;
  projectId: string;
  upvotes: number;
  downvotes: number;
  userVote: number | null;
}

/**
 * Thumbs up/down vote buttons with active state highlighting and toast feedback
 */
export function VoteButtons({
  proposalId,
  projectId,
  upvotes,
  downvotes,
  userVote,
}: VoteButtonsProps) {
  const [isPending, startTransition] = useTransition();

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

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Vote on this proposal">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleVote(1)}
        disabled={isPending}
        aria-label={`Upvote (${upvotes} votes)${userVote === 1 ? " - your vote" : ""}`}
        aria-pressed={userVote === 1}
        className={cn(
          "transition-colors duration-150",
          userVote === 1
            ? "text-green-600 hover:text-green-700 dark:text-green-400"
            : "text-muted-foreground hover:text-green-600 dark:hover:text-green-400"
        )}
      >
        <ThumbsUp className="mr-1 h-4 w-4" aria-hidden="true" />
        <span className="text-sm font-medium">{upvotes}</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleVote(-1)}
        disabled={isPending}
        aria-label={`Downvote (${downvotes} votes)${userVote === -1 ? " - your vote" : ""}`}
        aria-pressed={userVote === -1}
        className={cn(
          "transition-colors duration-150",
          userVote === -1
            ? "text-red-600 hover:text-red-700 dark:text-red-400"
            : "text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
        )}
      >
        <ThumbsDown className="mr-1 h-4 w-4" aria-hidden="true" />
        <span className="text-sm font-medium">{downvotes}</span>
      </Button>
    </div>
  );
}
