"use client";

import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { type UserData, type TranslateFn, ROLES, ROLE_COLORS, getUserName } from "./user-role-manager-types";

interface RoleControlProps {
  user: UserData;
  isSelf: boolean;
  loadingId: string | null;
  onRoleChange: (userId: string, newRole: string) => void;
  t: TranslateFn;
}

function RoleControl({ user, isSelf, loadingId, onRoleChange, t }: RoleControlProps) {
  if (isSelf) {
    return (
      <Badge className={ROLE_COLORS[user.role] || ""} variant="outline">
        {t(`role.${user.role}`)} {t("admin.you")}
      </Badge>
    );
  }
  return (
    <select
      value={user.role}
      onChange={(e) => onRoleChange(user.id, e.target.value)}
      disabled={loadingId === user.id}
      aria-label={t("a11y.changeRoleFor", { email: user.email })}
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

interface UserMobileCardProps {
  user: UserData;
  currentUserId: string;
  selected: Set<string>;
  loadingId: string | null;
  onToggleSelect: (userId: string) => void;
  onRoleChange: (userId: string, newRole: string) => void;
  locale: string;
  t: TranslateFn;
}

export function UserMobileCard({
  user,
  currentUserId,
  selected,
  loadingId,
  onToggleSelect,
  onRoleChange,
  locale,
  t,
}: UserMobileCardProps) {
  const name = getUserName(user);
  const isSelf = user.id === currentUserId;

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-start gap-2">
        {!isSelf && (
          <input
            type="checkbox"
            checked={selected.has(user.id)}
            onChange={() => onToggleSelect(user.id)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300"
          />
        )}
        <div className="flex flex-1 items-start justify-between gap-2">
          <p className="min-w-0 break-all text-sm font-medium">{user.email}</p>
          <RoleControl
            user={user}
            isSelf={isSelf}
            loadingId={loadingId}
            onRoleChange={onRoleChange}
            t={t}
          />
        </div>
      </div>
      {name && (
        <p className="text-xs text-muted-foreground">{name}</p>
      )}
      <p className="text-xs text-muted-foreground">
        {user.createdAt ? formatDate(user.createdAt, locale, "short") : ""}
      </p>
    </div>
  );
}

interface UserTableRowProps {
  user: UserData;
  currentUserId: string;
  selected: Set<string>;
  loadingId: string | null;
  onToggleSelect: (userId: string) => void;
  onRoleChange: (userId: string, newRole: string) => void;
  locale: string;
  t: TranslateFn;
}

export function UserTableRow({
  user,
  currentUserId,
  selected,
  loadingId,
  onToggleSelect,
  onRoleChange,
  locale,
  t,
}: UserTableRowProps) {
  const name = getUserName(user);
  const isSelf = user.id === currentUserId;

  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-2">
        {!isSelf && (
          <input
            type="checkbox"
            checked={selected.has(user.id)}
            onChange={() => onToggleSelect(user.id)}
            className="h-4 w-4 rounded border-gray-300"
          />
        )}
      </td>
      <td className="max-w-[200px] truncate py-2 pr-4" title={user.email}>
        {user.email}
      </td>
      <td className="py-2 pr-4">
        {name || (
          <span className="text-muted-foreground">{t("admin.nameNotSet")}</span>
        )}
      </td>
      <td className="py-2 pr-4">
        <RoleControl
          user={user}
          isSelf={isSelf}
          loadingId={loadingId}
          onRoleChange={onRoleChange}
          t={t}
        />
      </td>
      <td className="py-2 text-muted-foreground">
        {user.createdAt ? formatDate(user.createdAt, locale, "short") : ""}
      </td>
    </tr>
  );
}
