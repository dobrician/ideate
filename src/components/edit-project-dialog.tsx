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

interface EditProjectDialogProps {
  projectId: string;
  title: string;
  description: string | null;
  deadline: string | number | Date | null;
  status: string;
}

export function EditProjectDialog({
  projectId,
  title,
  description,
  deadline,
  status,
}: EditProjectDialogProps) {
  const router = useRouter();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);
    setError("");

    try {
      const formData = new FormData(e.currentTarget);
      const result = await updateProject(projectId, formData);

      if (result?.error) {
        setError(result.error);
        toast.error(result.error);
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
        <Button variant="outline" size="sm">
          <Pencil className="mr-1 h-3.5 w-3.5" />
          {t("projects.edit")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("projectForm.editTitle")}</DialogTitle>
          <DialogDescription>{t("projectForm.editDesc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="csrfToken" value={getCsrfTokenClient()} />

          <div className="space-y-1.5">
            <Label htmlFor="edit-title">{t("projectForm.titleRequired")}</Label>
            <Input
              id="edit-title"
              name="title"
              type="text"
              defaultValue={title}
              required
              minLength={3}
              maxLength={200}
              disabled={isSaving}
            />
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
              required
              min={new Date().toISOString().split("T")[0]}
              disabled={isSaving}
            />
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

          {error && (
            <div className="rounded-md bg-red-50 p-3 dark:bg-red-950">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isSaving}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving ? t("projectForm.saving") : t("projectForm.update")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
