"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/lib/use-locale";
import { getCsrfTokenClient } from "@/lib/csrf-client";
import { toast } from "sonner";
import { createCustomRole, updateCustomRole, deleteCustomRole } from "./role-actions";
import { Plus, Trash2, Save, ChevronDown, ChevronRight } from "lucide-react";

const ALL_PERMISSIONS = [
  "project:create", "project:read", "project:update", "project:delete",
  "project:manage_all", "proposal:create", "proposal:read", "proposal:delete",
  "vote:cast", "comment:create", "comment:read", "user:manage", "user:view_all",
] as const;

interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
}

export function RoleManager({ initialRoles }: { initialRoles: CustomRole[] }) {
  const { t } = useLocale();
  const [roles, setRoles] = useState(initialRoles);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPerms, setNewPerms] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<Map<string, Set<string>>>(new Map());
  const [editDesc, setEditDesc] = useState<Map<string, string>>(new Map());

  function togglePerm(set: Set<string>, perm: string): Set<string> {
    const next = new Set(set);
    if (next.has(perm)) next.delete(perm); else next.add(perm);
    return next;
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    const result = await createCustomRole(newName, newDesc, [...newPerms], getCsrfTokenClient());
    if (result.error) { toast.error(t(result.error)); return; }
    toast.success(t("roles.created"));
    setNewName(""); setNewDesc(""); setNewPerms(new Set());
    window.location.reload();
  }

  async function handleUpdate(roleId: string) {
    const perms = editPerms.get(roleId);
    const desc = editDesc.get(roleId) ?? "";
    if (!perms) return;
    const result = await updateCustomRole(roleId, [...perms], desc, getCsrfTokenClient());
    if (result.error) { toast.error(t(result.error)); return; }
    toast.success(t("roles.updated"));
    setRoles((prev) => prev.map((r) =>
      r.id === roleId ? { ...r, permissions: [...perms], description: desc || null } : r
    ));
  }

  async function handleDelete(roleId: string) {
    if (!confirm(t("roles.deleteConfirm"))) return;
    const result = await deleteCustomRole(roleId, getCsrfTokenClient());
    if (result.error) { toast.error(t(result.error)); return; }
    toast.success(t("roles.deleted"));
    setRoles((prev) => prev.filter((r) => r.id !== roleId));
  }

  function expandRole(roleId: string) {
    if (expanded === roleId) { setExpanded(null); return; }
    setExpanded(roleId);
    const role = roles.find((r) => r.id === roleId);
    if (role && !editPerms.has(roleId)) {
      setEditPerms((prev) => new Map(prev).set(roleId, new Set(role.permissions)));
      setEditDesc((prev) => new Map(prev).set(roleId, role.description ?? ""));
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input placeholder={t("roles.name")} value={newName} onChange={(e) => setNewName(e.target.value)}
            className="sm:max-w-[180px]" aria-label={t("roles.name")} />
          <Input placeholder={t("roles.descriptionLabel")} value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
            className="sm:max-w-[220px]" aria-label={t("roles.descriptionLabel")} />
          <Button onClick={handleCreate} disabled={!newName.trim()}>
            <Plus className="mr-1 h-4 w-4" />{t("roles.create")}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label={t("roles.permissions")}>
          {ALL_PERMISSIONS.map((p) => (
            <Badge key={p} variant={newPerms.has(p) ? "default" : "outline"}
              className="cursor-pointer text-xs"
              role="checkbox"
              aria-checked={newPerms.has(p)}
              tabIndex={0}
              onClick={() => setNewPerms(togglePerm(newPerms, p))}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setNewPerms(togglePerm(newPerms, p)); } }}>
              {p}
            </Badge>
          ))}
        </div>
      </div>

      {roles.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("roles.noRoles")}</p>
      ) : (
        <ul className="space-y-2" role="list">
          {roles.map((role) => (
            <li key={role.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <button type="button" className="flex items-center gap-1 text-left"
                  onClick={() => expandRole(role.id)}
                  aria-expanded={expanded === role.id}
                  aria-controls={`role-panel-${role.id}`}>
                  {expanded === role.id
                    ? <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                  <span className="font-medium">{role.name}</span>
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({role.permissions.length} {t("roles.permCount")})
                  </span>
                </button>
                {!role.isSystem && (
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(role.id)}
                    aria-label={`Delete ${role.name}`}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
              {role.description && expanded !== role.id && (
                <p className="mt-1 text-xs text-muted-foreground">{role.description}</p>
              )}
              {expanded === role.id && (
                <div id={`role-panel-${role.id}`} className="mt-3 space-y-3 border-t pt-3" role="region" aria-label={`${role.name} ${t("roles.permissions")}`}>
                  <Input placeholder={t("roles.descriptionLabel")}
                    value={editDesc.get(role.id) ?? role.description ?? ""}
                    onChange={(e) => setEditDesc((prev) => new Map(prev).set(role.id, e.target.value))}
                    aria-label={t("roles.descriptionLabel")} />
                  <div className="flex flex-wrap gap-1" role="group" aria-label={t("roles.permissions")}>
                    {ALL_PERMISSIONS.map((p) => {
                      const perms = editPerms.get(role.id) ?? new Set(role.permissions);
                      const checked = perms.has(p);
                      return (
                        <Badge key={p} variant={checked ? "default" : "outline"}
                          className="cursor-pointer text-xs"
                          role="checkbox"
                          aria-checked={checked}
                          tabIndex={0}
                          onClick={() => setEditPerms((prev) => {
                            const next = new Map(prev);
                            next.set(role.id, togglePerm(perms, p));
                            return next;
                          })}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditPerms((prev) => { const next = new Map(prev); next.set(role.id, togglePerm(perms, p)); return next; }); } }}>
                          {p}
                        </Badge>
                      );
                    })}
                  </div>
                  <Button size="sm" onClick={() => handleUpdate(role.id)} disabled={role.isSystem}>
                    <Save className="mr-1 h-3.5 w-3.5" />{t("roles.save")}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
