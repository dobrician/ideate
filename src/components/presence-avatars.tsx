"use client";

import { useLocale } from "@/lib/use-locale";
import type { PresenceUser, ActivityStatus } from "@/lib/use-advanced-presence";

const activityColors: Record<ActivityStatus, string> = {
  editing: "bg-green-500 dark:bg-green-600",
  reviewing: "bg-blue-500 dark:bg-blue-600",
  typing: "bg-yellow-500 dark:bg-yellow-600",
  idle: "bg-gray-400 dark:bg-gray-600",
  online: "bg-green-400 dark:bg-green-500",
  offline: "bg-gray-300 dark:bg-gray-500",
};

/**
 * Displays avatar badges for present users with activity status indicators.
 */
export function PresenceAvatars({
  users,
  maxDisplay = 5,
}: {
  users: PresenceUser[];
  maxDisplay?: number;
}) {
  const { t } = useLocale();
  if (users.length === 0) return null;

  const displayed = users.slice(0, maxDisplay);
  const overflow = users.length - maxDisplay;

  return (
    <div className="flex items-center -space-x-2" role="group" aria-label={t("collaboration.participants")}>
      {displayed.map(user => (
        <div
          key={user.userId}
          className="relative inline-flex"
          role="img"
          aria-label={`${user.userName ?? "User"} — ${t(`collaboration.${user.activity}`)}`}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium">
            {((user.userName ?? "?")[0] || "?").toUpperCase()}
          </div>
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${activityColors[user.activity] ?? "bg-gray-300"}`}
            aria-hidden="true"
          />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium text-muted-foreground"
          aria-label={`${overflow} more`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
