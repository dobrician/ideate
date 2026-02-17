"use client";

import { useState } from "react";
import { updateUserRole } from "./actions";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";
import { getCsrfTokenClient } from "@/lib/csrf-client";

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

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  manager: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  member: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  viewer: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

/**
 * User role management table with inline role editing
 */
export function UserRoleManager({
  users,
  currentUserId,
}: UserRoleManagerProps) {
  const { t, locale } = useLocale();
  const [loadingId, setLoadingId] = useState<string | null>(null);

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

  return (
    <div className="overflow-x-auto">
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
          {users.map((u) => {
            const isSelf = u.id === currentUserId;
            const name =
              [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";

            return (
              <tr key={u.id} className="border-b last:border-0">
                <td className="max-w-[150px] truncate py-2 pr-4">{u.email}</td>
                <td className="py-2 pr-4">{name}</td>
                <td className="py-2 pr-4">
                  {isSelf ? (
                    <Badge
                      className={ROLE_COLORS[u.role] || ""}
                      variant="outline"
                    >
                      {u.role} {t("admin.you")}
                    </Badge>
                  ) : (
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      disabled={loadingId === u.id}
                      className="rounded border border-input bg-background px-2 py-2 text-base text-foreground md:text-xs"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="py-2 text-muted-foreground">
                  {u.createdAt
                    ? new Date(u.createdAt).toLocaleDateString(
                        locale === "ro" ? "ro-RO" : "en-US"
                      )
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
