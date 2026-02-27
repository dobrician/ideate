"use client";

import type { PresenceUser, ActivityStatus } from "@/lib/use-advanced-presence";

const activityColors: Record<ActivityStatus, string> = {
  editing: "bg-green-500",
  reviewing: "bg-blue-500",
  typing: "bg-yellow-500",
  idle: "bg-gray-400",
  online: "bg-green-400",
  offline: "bg-gray-300",
};

const activityLabels: Record<ActivityStatus, string> = {
  editing: "Editing",
  reviewing: "Reviewing",
  typing: "Typing",
  idle: "Idle",
  online: "Online",
  offline: "Offline",
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
  if (users.length === 0) return null;

  const displayed = users.slice(0, maxDisplay);
  const overflow = users.length - maxDisplay;

  return (
    <div className="flex items-center -space-x-2" role="group" aria-label="Active participants">
      {displayed.map(user => (
        <div
          key={user.userId}
          className="relative inline-flex"
          title={`${user.userName ?? "User"} — ${activityLabels[user.activity]}`}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium">
            {(user.userName ?? "?")[0].toUpperCase()}
          </div>
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${activityColors[user.activity]}`}
            aria-label={activityLabels[user.activity]}
          />
        </div>
      ))}
      {overflow > 0 && (
        <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium text-muted-foreground">
          +{overflow}
        </div>
      )}
    </div>
  );
}
