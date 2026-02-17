"use client";

import { useState, useMemo } from "react";
import { updateUserRole, bulkUpdateUserRole, bulkDeleteUsers } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { getCsrfTokenClient } from "@/lib/csrf-client";
import { Search, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

interface UserData {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  createdAt: Date | null;
}

interface UserRoleManagerProps {
  users: UserData[];
  currentUserId: string;
}

const ROLES = ["admin", "manager", "member", "viewer"] as const;
const PAGE_SIZE = 20;

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  manager: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  member: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  viewer: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

export function UserRoleManager({
  users,
  currentUserId,
}: UserRoleManagerProps) {
  const { t, locale } = useLocale();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: "delete";
    ids: string[];
  } | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users.filter((u) => {
      const matchesSearch =
        !q ||
        u.email.toLowerCase().includes(q) ||
        (u.firstName?.toLowerCase().includes(q) ?? false) ||
        (u.lastName?.toLowerCase().includes(q) ?? false);
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const selectableOnPage = paginated.filter((u) => u.id !== currentUserId);
  const allOnPageSelected =
    selectableOnPage.length > 0 &&
    selectableOnPage.every((u) => selected.has(u.id));

  function toggleSelect(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        selectableOnPage.forEach((u) => next.delete(u.id));
      } else {
        selectableOnPage.forEach((u) => next.add(u.id));
      }
      return next;
    });
  }

  async function handleRoleChange(userId: string, newRole: string) {
    setLoadingId(userId);
    const result = await updateUserRole(userId, newRole, getCsrfTokenClient());
    setLoadingId(null);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("admin.roleUpdated"));
    }
  }

  async function handleBulkRoleChange(newRole: string) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkLoading(true);
    const result = await bulkUpdateUserRole(ids, newRole, getCsrfTokenClient());
    setBulkLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("admin.bulkRoleUpdated", { count: result.count ?? ids.length }));
      setSelected(new Set());
    }
  }

  async function handleBulkDelete() {
    if (!confirmDialog) return;
    const ids = confirmDialog.ids;
    setBulkLoading(true);
    setConfirmDialog(null);
    const result = await bulkDeleteUsers(ids, getCsrfTokenClient());
    setBulkLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("admin.bulkDeleted", { count: result.count ?? ids.length }));
      setSelected(new Set());
    }
  }

  function getUserName(u: UserData): string | null {
    const name = [u.firstName, u.lastName].filter(Boolean).join(" ");
    return name || null;
  }

  function renderRoleControl(u: UserData) {
    const isSelf = u.id === currentUserId;
    if (isSelf) {
      return (
        <Badge className={ROLE_COLORS[u.role] || ""} variant="outline">
          {t(`role.${u.role}`)} {t("admin.you")}
        </Badge>
      );
    }
    return (
      <select
        value={u.role}
        onChange={(e) => handleRoleChange(u.id, e.target.value)}
        disabled={loadingId === u.id}
        aria-label={t("a11y.changeRoleFor", { email: u.email })}
        className="rounded border border-input bg-background px-2 py-2 text-base text-foreground md:text-xs"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {t(`role.${r}`)}
          </option>
        ))}
      </select>
    );
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
          <select
            onChange={(e) => {
              if (e.target.value) handleBulkRoleChange(e.target.value);
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
            onClick={() =>
              setConfirmDialog({ type: "delete", ids: Array.from(selected) })
            }
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            {t("admin.bulkDelete")}
          </Button>
        </div>
      )}

      {/* Search & filter bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("admin.searchUsers")}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          aria-label={t("a11y.filterByRole")}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-base text-foreground md:text-sm"
        >
          <option value="all">{t("admin.allRoles")}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{t(`role.${r}`)}</option>
          ))}
        </select>
      </div>

      {paginated.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("search.noResults")}
        </p>
      ) : (
        <>
          {/* Mobile card layout */}
          <div className="space-y-3 md:hidden">
            {paginated.map((u) => {
              const name = getUserName(u);
              const isSelf = u.id === currentUserId;
              return (
                <div key={u.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    {!isSelf && (
                      <input
                        type="checkbox"
                        checked={selected.has(u.id)}
                        onChange={() => toggleSelect(u.id)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300"
                      />
                    )}
                    <div className="flex flex-1 items-start justify-between gap-2">
                      <p className="min-w-0 break-all text-sm font-medium">{u.email}</p>
                      {renderRoleControl(u)}
                    </div>
                  </div>
                  {name && (
                    <p className="text-xs text-muted-foreground">{name}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {u.createdAt ? formatDate(u.createdAt, locale, "short") : ""}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Desktop table layout */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-2 font-medium w-8">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleSelectAll}
                      aria-label={t("admin.selectAll")}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </th>
                  <th className="pb-2 font-medium">{t("admin.email")}</th>
                  <th className="pb-2 font-medium">{t("admin.name")}</th>
                  <th className="pb-2 font-medium">{t("admin.role")}</th>
                  <th className="pb-2 font-medium">{t("admin.joined")}</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((u) => {
                  const name = getUserName(u);
                  const isSelf = u.id === currentUserId;
                  return (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-2 pr-2">
                        {!isSelf && (
                          <input
                            type="checkbox"
                            checked={selected.has(u.id)}
                            onChange={() => toggleSelect(u.id)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                        )}
                      </td>
                      <td className="max-w-[200px] truncate py-2 pr-4" title={u.email}>
                        {u.email}
                      </td>
                      <td className="py-2 pr-4">
                        {name || (
                          <span className="text-muted-foreground">{t("admin.nameNotSet")}</span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {renderRoleControl(u)}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {u.createdAt
                          ? formatDate(u.createdAt, locale, "short")
                          : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            {t("admin.showingUsers", {
              from: (safePage - 1) * PAGE_SIZE + 1,
              to: Math.min(safePage * PAGE_SIZE, filtered.length),
              total: filtered.length,
            })}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              aria-label={t("pagination.previous")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
              aria-label={t("pagination.next")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Confirm delete dialog */}
      <Dialog
        open={!!confirmDialog}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog &&
                t("admin.bulkDeleteConfirmTitle", { count: confirmDialog.ids.length })}
            </DialogTitle>
            <DialogDescription>
              {t("admin.bulkDeleteConfirmDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              {t("admin.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete}>
              {t("admin.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
