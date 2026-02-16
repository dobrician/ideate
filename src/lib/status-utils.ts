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
