"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { ROLES, type TranslateFn } from "./user-role-manager-types";

interface BulkActionBarProps {
  selectedCount: number;
  bulkLoading: boolean;
  onBulkRoleChange: (role: string) => void;
  onDeleteClick: () => void;
  t: TranslateFn;
}

export function BulkActionBar({
  selectedCount,
  bulkLoading,
  onBulkRoleChange,
  onDeleteClick,
  t,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
      <span className="text-sm font-medium">
        {t("admin.selected", { count: selectedCount })}
      </span>
      <select
        onChange={(e) => {
          if (e.target.value) onBulkRoleChange(e.target.value);
          e.target.value = "";
        }}
        disabled={bulkLoading}
        defaultValue=""
        className="h-8 rounded border border-input bg-background px-2 text-sm"
      >
        <option value="" disabled>
          {t("admin.bulkChangeRole")}
        </option>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {t(`role.${r}`)}
          </option>
        ))}
      </select>
      <Button
        variant="destructive"
        size="sm"
        disabled={bulkLoading}
        onClick={onDeleteClick}
      >
        <Trash2 className="mr-1 h-3.5 w-3.5" />
        {t("admin.bulkDelete")}
      </Button>
    </div>
  );
}

interface ConfirmDeleteDialogProps {
  open: boolean;
  count: number;
  onClose: () => void;
  onConfirm: () => void;
  t: TranslateFn;
}

export function ConfirmDeleteDialog({
  open,
  count,
  onClose,
  onConfirm,
  t,
}: ConfirmDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {open && t("admin.bulkDeleteConfirmTitle", { count })}
          </DialogTitle>
          <DialogDescription>
            {t("admin.bulkDeleteConfirmDesc")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("admin.cancel")}
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {t("admin.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
