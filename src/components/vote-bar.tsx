"use client";

import { useLocale } from "@/lib/use-locale";

interface VoteBarProps {
  upvotes: number;
  downvotes: number;
}

/**
 * Horizontal bar chart showing pro vs contra vote distribution.
 * Pure CSS/Tailwind — no chart library needed.
 */
export function VoteBar({ upvotes, downvotes }: VoteBarProps) {
  const { t } = useLocale();
  const total = upvotes + downvotes;

  if (total === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="h-2 flex-1 rounded-full bg-muted" />
        <span>{t("vote.noVotes")}</span>
      </div>
    );
  }

  const proPercent = Math.round((upvotes / total) * 100);
  const conPercent = 100 - proPercent;

  return (
    <div className="space-y-1">
      <div className="flex h-3 overflow-hidden rounded-full">
        {proPercent > 0 && (
          <div
            className="bg-green-500 transition-all duration-300"
            style={{ width: `${proPercent}%` }}
          />
        )}
        {conPercent > 0 && (
          <div
            className="bg-red-500 transition-all duration-300"
            style={{ width: `${conPercent}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="text-green-600 dark:text-green-400">
          {proPercent}% {t("vote.pro").toLowerCase()} ({upvotes})
        </span>
        <span className="text-red-600 dark:text-red-400">
          {conPercent}% {t("vote.contra").toLowerCase()} ({downvotes})
        </span>
      </div>
    </div>
  );
}
