"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale } from "@/lib/use-locale";

/** Switch between current decisions and the archive without configuration panels. */
export function ProjectFilters() {
  const { t } = useLocale();
  const archived = useSearchParams().get("status") === "archived";
  return (
    <nav aria-label={t("projects.title")} className="flex gap-1 text-sm">
      {[{ href: "/projects", label: t("projects.current"), selected: !archived },
        { href: "/projects?status=archived", label: t("projects.archive"), selected: archived }]
        .map(item => <Link key={item.href} href={item.href} aria-current={item.selected ? "page" : undefined}
          className={`inline-flex min-h-11 items-center rounded-lg px-3 ${item.selected ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"}`}>
          {item.label}
        </Link>)}
    </nav>
  );
}
