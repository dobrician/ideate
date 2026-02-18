"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";
import { formatDate } from "@/lib/utils";
import { statusBadgeClass, statusLabel } from "@/lib/status-utils";
import { getCsrfTokenClient } from "@/lib/csrf-client";
import { bulkArchiveProjects, bulkDeleteProjects } from "./project-actions";
import { Archive, Trash2 } from "lucide-react";

interface ProjectData {
  id: string;
  title: string;
  status: string;
  createdAt: Date | null;
}

interface ProjectManagerProps {
  projects: ProjectData[];
}

export function ProjectManager({ projects }: ProjectManagerProps) {
  const { t, locale } = useLocale();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: "archive" | "delete";
    ids: string[];
  } | null>(null);

  const allSelected =
    projects.length > 0 && projects.every((p) => selected.has(p.id));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      if (allSelected) return new Set();
      return new Set(projects.map((p) => p.id));
    });
  }

  async function handleConfirm() {
    if (!confirmDialog) return;
    setBulkLoading(true);
    const csrf = getCsrfTokenClient();
    let result;

    if (confirmDialog.type === "archive") {
      result = await bulkArchiveProjects(confirmDialog.ids, csrf);
    } else {
      result = await bulkDeleteProjects(confirmDialog.ids, csrf);
    }

    setBulkLoading(false);
    setConfirmDialog(null);

    if (result.error) {
      toast.error(t(result.error));
    } else {
      const msg =
        confirmDialog.type === "archive"
          ? t("admin.bulkProjectsArchived", { count: result.count ?? confirmDialog.ids.length })
          : t("admin.bulkProjectsDeleted", { count: result.count ?? confirmDialog.ids.length });
      toast.success(msg);
      setSelected(new Set());
    }
  }

  const selectedCount = selected.size;

  return (
    <div className="space-y-4">
      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
          <span className="text-sm font-medium">
            {t("admin.selected", { count: selectedCount })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={bulkLoading}
            onClick={() =>
              setConfirmDialog({ type: "archive", ids: Array.from(selected) })
            }
          >
            <Archive className="mr-1 h-3.5 w-3.5" />
            {t("admin.bulkArchive")}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={bulkLoading}
            onClick={() =>
              setConfirmDialog({ type: "delete", ids: Array.from(selected) })
            }
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            {t("admin.bulkDelete")}
          </Button>
        </div>
      )}

      {projects.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("search.noResults")}
        </p>
      ) : (
        <>
          {/* Mobile card layout */}
          <div className="space-y-3 md:hidden">
            {projects.map((p) => (
              <div key={p.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggleSelect(p.id)}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300"
                  />
                  <div className="flex flex-1 items-start justify-between gap-2">
                    <p className="text-sm font-medium">{p.title}</p>
                    <Badge className={statusBadgeClass(p.status)}>
                      {statusLabel(p.status, t)}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {p.createdAt ? formatDate(p.createdAt, locale, "short") : ""}
                </p>
              </div>
            ))}
          </div>

          {/* Desktop table layout */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-2 font-medium w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label={t("admin.selectAll")}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </th>
                  <th className="pb-2 font-medium">{t("admin.projectTitle")}</th>
                  <th className="pb-2 font-medium">{t("admin.projectStatus")}</th>
                  <th className="pb-2 font-medium">{t("admin.projectCreated")}</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </td>
                    <td className="max-w-[300px] truncate py-2 pr-4" title={p.title}>
                      {p.title}
                    </td>
                    <td className="py-2 pr-4">
                      <Badge className={statusBadgeClass(p.status)}>
                        {statusLabel(p.status, t)}
                      </Badge>
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {p.createdAt ? formatDate(p.createdAt, locale, "short") : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Confirm dialog */}
      <Dialog
        open={!!confirmDialog}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.type === "archive"
                ? t("admin.bulkArchiveConfirmTitle", { count: confirmDialog.ids.length })
                : confirmDialog
                  ? t("admin.bulkDeleteProjectsConfirmTitle", { count: confirmDialog.ids.length })
                  : ""}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.type === "archive"
                ? t("admin.bulkArchiveConfirmDesc")
                : t("admin.bulkDeleteProjectsConfirmDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              {t("admin.cancel")}
            </Button>
            <Button
              variant={confirmDialog?.type === "delete" ? "destructive" : "default"}
              onClick={handleConfirm}
            >
              {t("admin.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
