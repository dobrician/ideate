import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Reusable stat card for dashboard and admin pages.
 * Displays a title, numeric value, and optional icon.
 * Optionally links to a filtered view via href.
 */
export function StatCard({
  title,
  value,
  icon,
  description,
  href,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  description?: string;
  href?: string;
}) {
  const card = (
    <Card className={href ? "transition-shadow hover:shadow-md" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <span aria-hidden="true">{icon}</span>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold" aria-label={`${title}: ${value}`}>
          {value.toLocaleString()}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );

  if (href) return <Link href={href}>{card}</Link>;
  return card;
}

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Format a Date into a locale-aware relative time string.
 * Accepts an optional t() function for localized output.
 */
export function formatRelativeTime(date: Date, t?: TranslateFn): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t ? t("time.justNow") : "just now";
  if (minutes < 60) return t ? t("time.minutesAgo", { count: minutes }) : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t ? t("time.hoursAgo", { count: hours }) : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return t ? t("time.daysAgo", { count: days }) : `${days}d ago`;
}
