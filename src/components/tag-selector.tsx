"use client";

import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useLocale } from "@/lib/use-locale";

interface TagSelectorProps {
  availableTags: { id: string; name: string }[];
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  disabled?: boolean;
}

export function TagSelector({
  availableTags,
  selectedTagIds,
  onChange,
  disabled,
}: TagSelectorProps) {
  const { t } = useLocale();

  if (availableTags.length === 0) return null;

  function handleAdd(tagId: string) {
    if (!tagId || selectedTagIds.includes(tagId)) return;
    onChange([...selectedTagIds, tagId]);
  }

  function handleRemove(tagId: string) {
    onChange(selectedTagIds.filter((id) => id !== tagId));
  }

  const unselected = availableTags.filter(
    (tag) => !selectedTagIds.includes(tag.id)
  );

  return (
    <div className="space-y-2">
      {selectedTagIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTagIds.map((tagId) => {
            const tag = availableTags.find((t) => t.id === tagId);
            if (!tag) return null;
            return (
              <Badge key={tag.id} variant="secondary" className="gap-1 pr-1">
                {tag.name}
                <button
                  type="button"
                  onClick={() => handleRemove(tag.id)}
                  disabled={disabled}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                  aria-label={t("tags.removeTag", { name: tag.name })}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
      {unselected.length > 0 && (
        <select
          value=""
          onChange={(e) => handleAdd(e.target.value)}
          disabled={disabled}
          aria-label={t("tags.selectTag")}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground"
        >
          <option value="">{t("tags.addToProject")}</option>
          {unselected.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
