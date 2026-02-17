"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useLocale } from "@/lib/use-locale";

const SORT_OPTIONS = ["votes", "newest", "oldest", "comments", "controversy"] as const;

interface ProposalSortSelectorProps {
  currentSort: string;
}

export function ProposalSortSelector({ currentSort }: ProposalSortSelectorProps) {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "votes") {
      params.delete("sort");
    } else {
      params.set("sort", value);
    }
    // Reset page when changing sort
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={currentSort}
      onChange={(e) => handleChange(e.target.value)}
      aria-label={t("proposals.sortLabel")}
      className="h-8 rounded-md border border-input bg-background px-2 text-sm"
    >
      {SORT_OPTIONS.map((opt) => (
        <option key={opt} value={opt}>
          {t(`proposals.sort.${opt}`)}
        </option>
      ))}
    </select>
  );
}
