"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteProject } from "../actions";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";

interface DeleteProjectButtonProps {
  projectId: string;
}

/**
 * Delete project button with confirmation and toast feedback
 */
export function DeleteProjectButton({ projectId }: DeleteProjectButtonProps) {
  const { t } = useLocale();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);

    try {
      const result = await deleteProject(projectId);

      if (result?.error) {
        toast.error(result.error);
        setIsDeleting(false);
        setShowConfirm(false);
      }
      // If successful, deleteProject redirects automatically
    } catch {
      toast.error(t("deleteProject.failed"));
      setIsDeleting(false);
      setShowConfirm(false);
    }
  }

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? t("deleteProject.deleting") : t("deleteProject.confirm")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowConfirm(false)}
          disabled={isDeleting}
        >
          {t("common.cancel")}
        </Button>
      </div>
    );
  }

  return (
    <Button variant="destructive" size="sm" onClick={() => setShowConfirm(true)}>
      {t("common.delete")}
    </Button>
  );
}
