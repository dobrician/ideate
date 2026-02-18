"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/lib/use-locale";
import { getCsrfTokenClient } from "@/lib/csrf-client";
import { toast } from "sonner";
import { createTeam, deleteTeam, addTeamMember, removeTeamMember } from "./team-actions";
import { Plus, Trash2, UserPlus } from "lucide-react";

interface TeamMember {
  userId: string;
  email: string;
  firstName: string | null;
  role: string;
}

interface Team {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  members: TeamMember[];
}

export function TeamManager({ initialTeams }: { initialTeams: Team[] }) {
  const { t } = useLocale();
  const [teamsList, setTeams] = useState(initialTeams);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("member");

  async function handleCreate() {
    if (!newName.trim()) return;
    const result = await createTeam(newName, newDesc, getCsrfTokenClient());
    if (result.error) { toast.error(t(result.error)); return; }
    toast.success(t("teams.created"));
    setNewName("");
    setNewDesc("");
    window.location.reload();
  }

  async function handleDelete(teamId: string) {
    if (!confirm(t("teams.deleteConfirm"))) return;
    const result = await deleteTeam(teamId, getCsrfTokenClient());
    if (result.error) { toast.error(t(result.error)); return; }
    toast.success(t("teams.deleted"));
    setTeams((prev) => prev.filter((tm) => tm.id !== teamId));
  }

  async function handleAddMember(teamId: string) {
    if (!memberEmail.trim()) return;
    const result = await addTeamMember(teamId, memberEmail, memberRole, getCsrfTokenClient());
    if (result.error) { toast.error(t(result.error)); return; }
    toast.success(t("teams.memberAdded"));
    setMemberEmail("");
    window.location.reload();
  }

  async function handleRemoveMember(teamId: string, memberId: string) {
    const result = await removeTeamMember(teamId, memberId, getCsrfTokenClient());
    if (result.error) { toast.error(t(result.error)); return; }
    toast.success(t("teams.memberRemoved"));
    setTeams((prev) =>
      prev.map((tm) =>
        tm.id === teamId
          ? { ...tm, members: tm.members.filter((m) => m.userId !== memberId) }
          : tm
      )
    );
  }

  const roleColors: Record<string, string> = {
    owner: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
    admin: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
    member: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
    viewer: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };

  return (
    <div className="space-y-4">
      {/* Create form */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder={t("teams.name")}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="sm:max-w-[200px]"
          aria-label={t("teams.name")}
        />
        <Input
          placeholder={t("teams.descriptionLabel")}
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          className="sm:max-w-[250px]"
          aria-label={t("teams.descriptionLabel")}
        />
        <Button onClick={handleCreate} disabled={!newName.trim()}>
          <Plus className="mr-1 h-4 w-4" />{t("teams.create")}
        </Button>
      </div>

      {/* Team list */}
      {teamsList.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("teams.noTeams")}</p>
      ) : (
        <ul className="space-y-3" role="list">
          {teamsList.map((team) => (
            <li key={team.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="text-left"
                  onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}
                >
                  <span className="font-medium">{team.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">/{team.slug}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {t("teams.memberCount", { count: team.members.length })}
                  </span>
                </button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(team.id)} aria-label={`Delete ${team.name}`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              {team.description && (
                <p className="mt-1 text-xs text-muted-foreground">{team.description}</p>
              )}

              {expandedTeam === team.id && (
                <div className="mt-3 space-y-2 border-t pt-3">
                  {/* Members */}
                  <ul className="space-y-1" role="list">
                    {team.members.map((m) => (
                      <li key={m.userId} className="flex items-center justify-between text-sm">
                        <span>
                          {m.firstName || m.email}
                          <Badge className={`ml-2 text-xs ${roleColors[m.role] || ""}`}>{m.role}</Badge>
                        </span>
                        {m.role !== "owner" && (
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(team.id, m.userId)}>
                            {t("teams.removeMember")}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {/* Add member */}
                  <div className="flex gap-2">
                    <Input
                      placeholder={t("teams.email")}
                      value={memberEmail}
                      onChange={(e) => setMemberEmail(e.target.value)}
                      className="max-w-[200px]"
                      aria-label={t("teams.email")}
                    />
                    <select
                      value={memberRole}
                      onChange={(e) => setMemberRole(e.target.value)}
                      className="rounded-md border px-2 py-1 text-sm"
                      aria-label={t("teams.role")}
                    >
                      <option value="admin">{t("teams.admin")}</option>
                      <option value="member">{t("teams.member")}</option>
                      <option value="viewer">{t("teams.viewer")}</option>
                    </select>
                    <Button size="sm" onClick={() => handleAddMember(team.id)} disabled={!memberEmail.trim()}>
                      <UserPlus className="mr-1 h-3.5 w-3.5" />{t("teams.addMember")}
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
