"use client";

/**
 * Displays the live count of participants currently viewing a project.
 * Subscribes to presence updates via the useProjectUpdates hook.
 */

import { Users } from "lucide-react";
import { useLocale } from "@/lib/use-locale";

interface LiveParticipantCountProps {
  count: number;
}

export function LiveParticipantCount({ count }: LiveParticipantCountProps) {
  const { t } = useLocale();

  if (count === 0) return null;

  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
      <Users className="h-3 w-3" />
      {t("live.participantCount", { count })}
    </span>
  );
}
