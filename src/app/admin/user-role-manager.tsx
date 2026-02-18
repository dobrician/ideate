"use client";

import { useState, useMemo } from "react";
import { updateUserRole, bulkUpdateUserRole, bulkDeleteUsers } from "./user-actions";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";
import { getCsrfTokenClient } from "@/lib/csrf-client";
import { Search } from "lucide-react";
import { type UserData, ROLES, PAGE_SIZE } from "./user-role-manager-types";
import { BulkActionBar, ConfirmDeleteDialog } from "./user-bulk-actions";
import { UserPagination } from "./user-pagination";
import { UserTableRow, UserMobileCard } from "./user-table-row";

// Re-export types for any external consumers
export type { UserData } from "./user-role-manager-types";

interface UserRoleManagerProps {
  users: UserData[];
  currentUserId: string;
}

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
      toast.error(t(result.error));
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
      toast.error(t(result.error));
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
      toast.error(t(result.error));
    } else {
      toast.success(t("admin.bulkDeleted", { count: result.count ?? ids.length }));
      setSelected(new Set());
    }
  }

  return (
    <div className="space-y-4">
      {/* Bulk action bar */}
      <BulkActionBar
        selectedCount={selected.size}
        bulkLoading={bulkLoading}
        onBulkRoleChange={handleBulkRoleChange}
        onDeleteClick={() =>
          setConfirmDialog({ type: "delete", ids: Array.from(selected) })
        }
        t={t}
      />

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
            {paginated.map((u) => (
              <UserMobileCard
                key={u.id}
                user={u}
                currentUserId={currentUserId}
                selected={selected}
                loadingId={loadingId}
                onToggleSelect={toggleSelect}
                onRoleChange={handleRoleChange}
                locale={locale}
                t={t}
              />
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
                {paginated.map((u) => (
                  <UserTableRow
                    key={u.id}
                    user={u}
                    currentUserId={currentUserId}
                    selected={selected}
                    loadingId={loadingId}
                    onToggleSelect={toggleSelect}
                    onRoleChange={handleRoleChange}
                    locale={locale}
                    t={t}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Pagination */}
      <UserPagination
        safePage={safePage}
        totalPages={totalPages}
        filteredCount={filtered.length}
        onPageChange={setPage}
        t={t}
      />

      {/* Confirm delete dialog */}
      <ConfirmDeleteDialog
        open={!!confirmDialog}
        count={confirmDialog?.ids.length ?? 0}
        onClose={() => setConfirmDialog(null)}
        onConfirm={handleBulkDelete}
        t={t}
      />
    </div>
  );
}
