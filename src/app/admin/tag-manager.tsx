"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";
import { getCsrfTokenClient } from "@/lib/csrf-client";
import { createTag, deleteTag } from "./project-actions";
import { X } from "lucide-react";

interface TagManagerProps {
  initialTags: { id: string; name: string }[];
}

export function TagManager({ initialTags }: TagManagerProps) {
  const { t } = useLocale();
  const [allTags, setAllTags] = useState(initialTags);
  const [newTagName, setNewTagName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    const name = newTagName.trim();
    if (!name) return;

    setLoading(true);
    const result = await createTag(name, getCsrfTokenClient());
    setLoading(false);

    if (result.error) {
      toast.error(t(result.error));
    } else {
      setAllTags((prev) => [...prev, { id: result.id!, name }]);
      setNewTagName("");
      toast.success(t("tags.created"));
    }
  }

  async function handleDelete(tagId: string) {
    const result = await deleteTag(tagId, getCsrfTokenClient());
    if (result.error) {
      toast.error(t(result.error));
    } else {
      setAllTags((prev) => prev.filter((tag) => tag.id !== tagId));
      toast.success(t("tags.deleted"));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          placeholder={t("tags.namePlaceholder")}
          maxLength={50}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            }
          }}
        />
        <Button onClick={handleCreate} disabled={loading || !newTagName.trim()}>
          {loading ? t("tags.creating") : t("tags.add")}
        </Button>
      </div>

      {allTags.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("tags.noTags")}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {allTags.map((tag) => (
            <Badge key={tag.id} variant="secondary" className="gap-1 pr-1">
              {tag.name}
              <button
                onClick={() => handleDelete(tag.id)}
                className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label={t("tags.deleteTag", { name: tag.name })}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
