"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useLocale } from "@/lib/use-locale";

interface TagFilterProps {
  tags: { id: string; name: string }[];
  activeTagId?: string;
}

export function TagFilter({ tags, activeTagId }: TagFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useLocale();

  function handleChange(tagId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (tagId) {
      params.set("tag", tagId);
    } else {
      params.delete("tag");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={activeTagId || ""}
      onChange={(e) => handleChange(e.target.value)}
      className="h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={t("a11y.filterByTag")}
    >
      <option value="">{t("tags.allTags")}</option>
      {tags.map((tag) => (
        <option key={tag.id} value={tag.id}>{tag.name}</option>
      ))}
    </select>
  );
}
