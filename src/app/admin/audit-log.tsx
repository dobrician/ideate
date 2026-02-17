"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useLocale } from "@/lib/use-locale";
import { formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";

interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  createdAt: Date | string | null;
  userEmail: string | null;
}

const COLLAPSED_COUNT = 5;

export function AuditLog({ entries }: { entries: AuditEntry[] }) {
  const { t, locale } = useLocale();
  const [expanded, setExpanded] = useState(false);

  function handleExport(format: "csv" | "json") {
    try {
      window.open(`/api/admin/audit-export?format=${format}`, "_blank");
    } catch {
      toast.error(t("export.failed"));
    }
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("admin.noActivity")}</p>
    );
  }

  const visible = expanded ? entries : entries.slice(0, COLLAPSED_COUNT);

  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleExport("csv")}
          title={t("admin.exportCsvTooltip")}
        >
          <Download className="mr-1 h-3 w-3" />
          {t("export.csv")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleExport("json")}
          title={t("admin.exportJsonTooltip")}
        >
          <Download className="mr-1 h-3 w-3" />
          JSON
        </Button>
      </div>
      {visible.map((entry) => (
        <div
          key={entry.id}
          className="flex min-w-0 items-center gap-2 text-sm sm:gap-3"
        >
          <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs font-medium">
            {entry.action}
          </span>
          <span className="min-w-0 truncate font-medium">
            {entry.userEmail || "System"}
          </span>
          <span className="hidden min-w-0 truncate text-muted-foreground sm:inline">
            {entry.entity}
            {entry.entityId ? ` #${entry.entityId.substring(0, 8)}` : ""}
          </span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {entry.createdAt
              ? formatRelativeTime(entry.createdAt, locale, t)
              : ""}
          </span>
        </div>
      ))}
      {entries.length > COLLAPSED_COUNT && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? t("admin.showLess") : t("admin.showMore")}
        </Button>
      )}
    </div>
  );
}
