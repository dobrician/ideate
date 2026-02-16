"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteProject } from "../actions";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";
import { Trash2 } from "lucide-react";

interface DeleteProjectButtonProps {
  projectId: string;
}

/**
 * Delete project button with confirmation modal dialog
 */
export function DeleteProjectButton({ projectId }: DeleteProjectButtonProps) {
  const { t } = useLocale();
  const [isDeleting, setIsDeleting] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);

    try {
      const result = await deleteProject(projectId);

      if (result?.error) {
        toast.error(result.error);
        setIsDeleting(false);
        setOpen(false);
      }
    } catch {
      toast.error(t("deleteProject.failed"));
      setIsDeleting(false);
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" title={t("common.delete")}>
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          {t("common.delete")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deleteProject.confirm")}</DialogTitle>
          <DialogDescription>
            {t("projects.confirmDelete")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isDeleting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? t("deleteProject.deleting") : t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
