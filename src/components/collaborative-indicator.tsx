"use client";

import { useLocale } from "@/lib/use-locale";
import { Users, Edit3, Eye, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PresenceUser } from "@/lib/use-advanced-presence";

/**
 * Shows a compact bar indicating collaboration status:
 * - Number of participants
 * - Active editors count
 * - Connection state
 */
export function CollaborativeIndicator({
  users,
  isConnected,
}: {
  users: PresenceUser[];
  isConnected: boolean;
}) {
  const { t } = useLocale();
  const editors = users.filter(u => u.activity === "editing");
  const reviewers = users.filter(u => u.activity === "reviewing");

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {isConnected ? (
        <Wifi className="h-3.5 w-3.5 text-green-600 dark:text-green-400" aria-label={t("collaboration.connected")} />
      ) : (
        <WifiOff className="h-3.5 w-3.5 text-destructive" aria-label={t("collaboration.disconnected")} />
      )}
      {users.length > 0 && (
        <Badge variant="secondary" className="text-xs gap-1 px-1.5 py-0">
          <Users className="h-3 w-3" aria-hidden="true" />
          {users.length}
        </Badge>
      )}
      {editors.length > 0 && (
        <Badge variant="default" className="text-xs gap-1 px-1.5 py-0 bg-green-600 dark:bg-green-700">
          <Edit3 className="h-3 w-3" aria-hidden="true" />
          {editors.length} {t("collaboration.editing")}
        </Badge>
      )}
      {reviewers.length > 0 && (
        <Badge variant="outline" className="text-xs gap-1 px-1.5 py-0">
          <Eye className="h-3 w-3" aria-hidden="true" />
          {reviewers.length}
        </Badge>
      )}
    </div>
  );
}
