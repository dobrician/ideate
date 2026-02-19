"use client";

/**
 * Displays a live feed of recent project activity received via WebSocket.
 * Shows new proposals, status changes, and votes in real-time.
 */

import { FileText, Vote, RefreshCw, Trash2 } from "lucide-react";
import type { ActivityItem } from "@/lib/use-project-updates";
import { useLocale } from "@/lib/use-locale";

interface LiveActivityFeedProps {
  activities: ActivityItem[];
}

const ACTION_ICONS: Record<ActivityItem["action"], typeof FileText> = {
  proposal_added: FileText,
  proposal_deleted: Trash2,
  status_changed: RefreshCw,
  vote_cast: Vote,
};

function formatTimestamp(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function LiveActivityFeed({ activities }: LiveActivityFeedProps) {
  const { t } = useLocale();

  if (activities.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        {t("live.noActivity")}
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {activities.map((item) => {
        const Icon = ACTION_ICONS[item.action];
        return (
          <li
            key={item.id}
            className="flex items-start gap-2 text-xs text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-300"
          >
            <Icon className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium text-foreground">
                {item.userName ?? "Someone"}
              </span>{" "}
              {item.summary}
            </span>
            <span className="shrink-0 tabular-nums">
              {formatTimestamp(item.timestamp)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
