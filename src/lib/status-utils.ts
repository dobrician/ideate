type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Returns Tailwind classes for a project status badge.
 * Uses semantic colors: green=active, amber=draft, gray=archived.
 */
export function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300";
    case "draft":
      return "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300";
    case "archived":
      return "border-transparent bg-muted text-muted-foreground";
    default:
      return "border-transparent bg-muted text-muted-foreground";
  }
}

/**
 * Returns the translated label for a project status.
 */
export function statusLabel(status: string, t: TranslateFn): string {
  switch (status) {
    case "active":
      return t("projects.status.active");
    case "draft":
      return t("projects.status.draft");
    case "archived":
      return t("projects.status.archived");
    default:
      return status;
  }
}

/**
 * Returns { label, className } for a deadline badge.
 * red (overdue or <=3d), amber (4-7d), blue/neutral (>7d), null (no deadline).
 */
export function deadlineBadge(
  deadline: Date | null,
  t: TranslateFn,
): { label: string; className: string } | null {
  if (!deadline) return null;
  const now = Date.now();
  const diff = deadline.getTime() - now;
  const days = Math.ceil(diff / 86_400_000);
  if (days < 0) {
    return {
      label: t("dashboard.deadlineOverdue"),
      className: "border-transparent bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
    };
  }
  if (days <= 3) {
    return {
      label: t("dashboard.deadlineDaysLeft", { count: days }),
      className: "border-transparent bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
    };
  }
  if (days <= 7) {
    return {
      label: t("dashboard.deadlineDaysLeft", { count: days }),
      className: "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
    };
  }
  return {
    label: t("dashboard.deadlineDaysLeft", { count: days }),
    className: "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  };
}
