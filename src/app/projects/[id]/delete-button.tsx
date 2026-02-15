"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteProject } from "../actions";

interface DeleteProjectButtonProps {
  projectId: string;
}

/**
 * Delete project button with confirmation
 */
export function DeleteProjectButton({ projectId }: DeleteProjectButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setIsDeleting(true);
    setError("");

    try {
      const result = await deleteProject(projectId);

      if (result?.error) {
        setError(result.error);
        setIsDeleting(false);
        setShowConfirm(false);
      }
      // If successful, deleteProject redirects automatically
    } catch (err) {
      console.error("Delete error:", err);
      setError("Failed to delete project");
      setIsDeleting(false);
      setShowConfirm(false);
    }
  }

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        {error && (
          <span className="text-sm text-destructive">{error}</span>
        )}
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? "Deleting..." : "Confirm Delete"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowConfirm(false)}
          disabled={isDeleting}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="destructive"
      onClick={() => setShowConfirm(true)}
    >
      Delete
    </Button>
  );
}
