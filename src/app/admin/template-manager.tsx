"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/lib/use-locale";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface Template {
  id: string;
  name: string;
  description: string | null;
  titlePrefix: string | null;
  deadlineOffset: number | null;
  defaultTags: string[];
}

export function TemplateManager({
  initialTemplates,
}: {
  initialTemplates: Template[];
}) {
  const { t } = useLocale();
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [titlePrefix, setTitlePrefix] = useState("");
  const [deadlineOffset, setDeadlineOffset] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          titlePrefix: titlePrefix.trim() || null,
          deadlineOffset: deadlineOffset ? Number(deadlineOffset) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || t("templates.createFailed"));
        return;
      }

      const data = await res.json();
      setTemplates((prev) => [...prev, data.template]);
      setName("");
      setDescription("");
      setTitlePrefix("");
      setDeadlineOffset("");
      toast.success(t("templates.created"));
    } catch {
      toast.error(t("templates.createFailed"));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/templates/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTemplates((prev) => prev.filter((tpl) => tpl.id !== id));
        toast.success(t("templates.deleted"));
      }
    } catch {
      toast.error(t("templates.deleteFailed"));
    }
  };

  return (
    <div className="space-y-4">
      {/* Create form */}
      <div className="space-y-3 rounded-lg border p-4">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("templates.titlePlaceholder")}
          aria-label={t("templates.titleLabel")}
        />
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("templates.descriptionPlaceholder")}
          aria-label={t("templates.descriptionLabel")}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            value={titlePrefix}
            onChange={(e) => setTitlePrefix(e.target.value)}
            placeholder={t("templates.titlePrefixPlaceholder")}
            aria-label={t("templates.titlePrefix")}
          />
          <Input
            value={deadlineOffset}
            onChange={(e) => setDeadlineOffset(e.target.value)}
            placeholder={t("templates.deadlineOffsetPlaceholder")}
            type="number"
            min="1"
            aria-label={t("templates.deadlineOffset")}
          />
        </div>
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={creating || !name.trim()}
        >
          <Plus className="mr-1 h-4 w-4" />
          {creating ? t("templates.creating") : t("templates.create")}
        </Button>
      </div>

      {/* Template list */}
      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("templates.none")}</p>
      ) : (
        <div className="divide-y rounded-lg border">
          {templates.map((tpl) => (
            <div key={tpl.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium">{tpl.name}</span>
                <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {tpl.titlePrefix && (
                    <span>{t("templates.titlePrefix")}: {tpl.titlePrefix}</span>
                  )}
                  {tpl.deadlineOffset && (
                    <span>{t("templates.deadlineOffset")}: {tpl.deadlineOffset}d</span>
                  )}
                </div>
                {tpl.description && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {tpl.description}
                  </p>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive"
                onClick={() => handleDelete(tpl.id)}
                title={t("templates.delete")}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
