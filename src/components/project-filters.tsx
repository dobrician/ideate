"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useLocale } from "@/lib/use-locale";

const SORT_OPTIONS = [
  { value: "newest", key: "projects.sortNewest" },
  { value: "oldest", key: "projects.sortOldest" },
  { value: "name", key: "projects.sortName" },
  { value: "name-desc", key: "projects.sortNameDesc" },
] as const;

const STATUS_OPTIONS = ["active", "archived", "draft"] as const;

export function ProjectFilters() {
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSearch = searchParams.get("q") ?? "";
  const currentSort = searchParams.get("sort") ?? "newest";
  const currentStatus = searchParams.get("status") ?? "all";

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === "all" || (key === "sort" && value === "newest")) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      // Reset to page 1 on filter change
      params.delete("page");
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder={t("projects.searchPlaceholder")}
          defaultValue={currentSearch}
          onChange={(e) => {
            const value = e.target.value;
            // Debounce via setTimeout stored on the element
            const el = e.target as HTMLInputElement & { _timer?: ReturnType<typeof setTimeout> };
            clearTimeout(el._timer);
            el._timer = setTimeout(() => updateParams({ q: value }), 300);
          }}
          className="pl-9"
        />
      </div>
      <select
        value={currentSort}
        onChange={(e) => updateParams({ sort: e.target.value })}
        aria-label={t("a11y.sortBy")}
        className="h-10 rounded-md border border-input bg-background px-3 py-2 text-base text-foreground md:text-sm"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {t(opt.key)}
          </option>
        ))}
      </select>
      <select
        value={currentStatus}
        onChange={(e) => updateParams({ status: e.target.value })}
        aria-label={t("a11y.filterByStatus")}
        className="h-10 rounded-md border border-input bg-background px-3 py-2 text-base text-foreground md:text-sm"
      >
        <option value="all">{t("projects.allStatuses")}</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {t(`projects.status.${s}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
