"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { updateProject } from "@/app/projects/actions";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";
import { getCsrfTokenClient } from "@/lib/csrf-client";
import { Pencil } from "lucide-react";
import { TagSelector } from "@/components/tag-selector";

interface EditProjectDialogProps {
  projectId: string;
  title: string;
  description: string | null;
  deadline: string | number | Date | null;
  status: string;
  availableTags?: { id: string; name: string }[];
  currentTagIds?: string[];
}

export function EditProjectDialog({
  projectId,
  title,
  description,
  deadline,
  status,
  availableTags = [],
  currentTagIds = [],
}: EditProjectDialogProps) {
  const router = useRouter();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; deadline?: string }>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(currentTagIds);

  function handleBlur(field: string, value: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === "title") {
      setFieldErrors((prev) => ({
        ...prev,
        title: !value.trim() ? t("projectForm.titleRequiredError") : value.trim().length < 3 ? t("projectForm.titleMinLength") : undefined,
      }));
    }
    if (field === "deadline") {
      setFieldErrors((prev) => ({ ...prev, deadline: !value ? t("projectForm.deadlineRequiredError") : undefined }));
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const titleVal = (formData.get("title") as string) || "";
    const deadlineVal = (formData.get("deadline") as string) || "";
    const tErr = !titleVal.trim() ? t("projectForm.titleRequiredError") : titleVal.trim().length < 3 ? t("projectForm.titleMinLength") : undefined;
    const dErr = !deadlineVal ? t("projectForm.deadlineRequiredError") : undefined;
    setFieldErrors({ title: tErr, deadline: dErr });
    setTouched({ title: true, deadline: true });
    if (tErr || dErr) return;

    setIsSaving(true);
    setError("");

    try {
      const formData = new FormData(e.currentTarget);
      const result = await updateProject(projectId, formData);

      if (result?.error) {
        setError(t(result.error));
        toast.error(t(result.error));
        setIsSaving(false);
      } else if (result?.success) {
        toast.success(t("projectForm.projectUpdated"));
        setOpen(false);
        router.refresh();
      }
    } catch {
      setError(t("common.errorOccurred"));
      toast.error(t("common.errorOccurred"));
      setIsSaving(false);
    }
  }

  const deadlineStr = deadline
    ? new Date(deadline).toISOString().split("T")[0]
    : "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Pencil className="mr-1 h-3 w-3" />
          {t("projects.edit")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("projectForm.editTitle")}</DialogTitle>
          <DialogDescription>{t("projectForm.editDesc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <input type="hidden" name="csrfToken" value={getCsrfTokenClient()} />

          <div className="space-y-1.5">
            <Label htmlFor="edit-title">{t("projectForm.titleRequired")}</Label>
            <Input
              id="edit-title"
              name="title"
              type="text"
              defaultValue={title}
              maxLength={200}
              disabled={isSaving}
              onBlur={(e) => handleBlur("title", e.target.value)}
              aria-invalid={touched.title && !!fieldErrors.title}
            />
            {touched.title && fieldErrors.title && (
              <p className="text-xs text-red-700 dark:text-red-400">{fieldErrors.title}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-description">{t("projectForm.description")}</Label>
            <Textarea
              id="edit-description"
              name="description"
              defaultValue={description || ""}
              rows={4}
              maxLength={5000}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-deadline">{t("projectForm.deadlineRequired")}</Label>
            <Input
              id="edit-deadline"
              name="deadline"
              type="date"
              defaultValue={deadlineStr}
              min={new Date().toISOString().split("T")[0]}
              disabled={isSaving}
              onBlur={(e) => handleBlur("deadline", e.target.value)}
              aria-invalid={touched.deadline && !!fieldErrors.deadline}
            />
            {touched.deadline && fieldErrors.deadline && (
              <p className="text-xs text-red-700 dark:text-red-400">{fieldErrors.deadline}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-status">{t("projectForm.status")}</Label>
            <select
              id="edit-status"
              name="status"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              defaultValue={status || "active"}
              disabled={isSaving}
            >
              <option value="active">{t("projects.status.active")}</option>
              <option value="draft">{t("projects.status.draft")}</option>
              <option value="archived">{t("projects.status.archived")}</option>
            </select>
          </div>

          {availableTags.length > 0 && (
            <div className="space-y-1.5">
              <Label>{t("tags.projectTags")}</Label>
              {selectedTagIds.map((id) => (
                <input key={id} type="hidden" name="tagIds" value={id} />
              ))}
              <TagSelector
                availableTags={availableTags}
                selectedTagIds={selectedTagIds}
                onChange={setSelectedTagIds}
                disabled={isSaving}
              />
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 p-3 dark:bg-red-950" role="alert">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSaving}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? t("projectForm.saving") : t("projectForm.update")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
