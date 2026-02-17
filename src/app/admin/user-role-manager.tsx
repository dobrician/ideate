"use client";

import { useState, useMemo } from "react";
import { updateUserRole } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";
import { formatDate } from "@/lib/utils";
import { getCsrfTokenClient } from "@/lib/csrf-client";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

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

/**
 * User role management with responsive card layout (mobile) and table (desktop)
 */
export function UserRoleManager({
  users,
  currentUserId,
}: UserRoleManagerProps) {
  const { t, locale } = useLocale();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

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

  return (
    <div className="space-y-4">
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
              return (
                <div key={u.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 break-all text-sm font-medium">{u.email}</p>
                    {renderRoleControl(u)}
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
                  <th className="pb-2 font-medium">{t("admin.email")}</th>
                  <th className="pb-2 font-medium">{t("admin.name")}</th>
                  <th className="pb-2 font-medium">{t("admin.role")}</th>
                  <th className="pb-2 font-medium">{t("admin.joined")}</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((u) => {
                  const name = getUserName(u);
                  return (
                    <tr key={u.id} className="border-b last:border-0">
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
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
