"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/lib/use-locale";
import { getCsrfTokenClient } from "@/lib/csrf-client";
import { Play, CheckCircle2, XCircle, Info } from "lucide-react";
import { ALL_PERMISSIONS } from "@/lib/rbac";
import { simulatePermissionAction } from "../../permission-actions";

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

interface SimResult {
  finalResult: { allowed: boolean; reason: string; ruleId?: string };
  matchingRules: Array<{ id: string; name: string; effect: string; ruleType: string; applies: boolean }>;
  matchingAcls: Array<{ id: string; effect: string; granteeType: string; granteeId: string }>;
  staticRbac: boolean;
}

const ROLES = ["admin", "manager", "member", "viewer"];

export function PermissionSimulator({ users }: { users: User[] }) {
  const { t } = useLocale();
  const csrf = getCsrfTokenClient();
  const [isPending, startTransition] = useTransition();

  const [selectedUser, setSelectedUser] = useState(users[0]?.id ?? "");
  const [selectedRole, setSelectedRole] = useState(users[0]?.role ?? "member");
  const [selectedPerm, setSelectedPerm] = useState<string>(ALL_PERMISSIONS[0]);
  const [entityType, setEntityType] = useState<string>("");
  const [entityId, setEntityId] = useState("");
  const [result, setResult] = useState<SimResult | null>(null);

  function handleUserChange(userId: string) {
    setSelectedUser(userId);
    const u = users.find(u => u.id === userId);
    if (u) setSelectedRole(u.role);
  }

  function handleSimulate() {
    startTransition(async () => {
      const res = await simulatePermissionAction({
        userId: selectedUser,
        userRole: selectedRole,
        permission: selectedPerm,
        entityType: entityType as "project" | "proposal" | undefined || undefined,
        entityId: entityId || undefined,
      }, csrf);
      if (res && "success" in res && res.success && "result" in res) {
        setResult(res.result as SimResult);
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("permissions.simulateTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{t("permissions.targetUser")}</Label>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={selectedUser} onChange={e => handleUserChange(e.target.value)}>
                {users.map(u => <option key={u.id} value={u.id}>{u.email} ({u.role})</option>)}
              </select>
            </div>
            <div>
              <Label>{t("permissions.simulateRole")}</Label>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={selectedRole} onChange={e => setSelectedRole(e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <Label>{t("permissions.permission")}</Label>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={selectedPerm} onChange={e => setSelectedPerm(e.target.value)}>
                {ALL_PERMISSIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <Label>{t("permissions.entityType")} ({t("permissions.optional")})</Label>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={entityType} onChange={e => setEntityType(e.target.value)}>
                <option value="">{t("permissions.none")}</option>
                <option value="project">{t("permissions.entityProject")}</option>
                <option value="proposal">{t("permissions.entityProposal")}</option>
              </select>
            </div>
            {entityType && (
              <div className="sm:col-span-2">
                <Label>{t("permissions.entityId")}</Label>
                <Input value={entityId} onChange={e => setEntityId(e.target.value)} placeholder={t("permissions.entityIdPlaceholder")} />
              </div>
            )}
          </div>
          <Button onClick={handleSimulate} disabled={isPending}>
            <Play className="mr-1.5 h-4 w-4" />
            {isPending ? t("common.loading") : t("permissions.runSimulation")}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.finalResult.allowed
                ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                : <XCircle className="h-5 w-5 text-destructive" />
              }
              {result.finalResult.allowed ? t("permissions.allowed") : t("permissions.denied")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-3 space-y-1">
              <p className="text-sm font-medium">{t("permissions.finalVerdict")}</p>
              <p className="text-sm text-muted-foreground">{result.finalResult.reason}</p>
              {result.finalResult.ruleId && (
                <p className="text-xs text-muted-foreground">{t("permissions.ruleId")}: {result.finalResult.ruleId}</p>
              )}
            </div>

            <div className="rounded-lg border p-3 space-y-2">
              <p className="flex items-center gap-1 text-sm font-medium">
                <Info className="h-4 w-4" />{t("permissions.staticRbac")}
              </p>
              <Badge variant={result.staticRbac ? "default" : "secondary"}>
                {result.staticRbac ? t("permissions.allowed") : t("permissions.denied")}
              </Badge>
            </div>

            {result.matchingRules.length > 0 && (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium">{t("permissions.matchingRules")} ({result.matchingRules.length})</p>
                {result.matchingRules.map(r => (
                  <div key={r.id} className="flex items-center gap-2 text-sm">
                    <Badge variant={r.effect === "grant" ? "default" : "destructive"} className="text-xs">{r.effect}</Badge>
                    <span>{r.name}</span>
                    <Badge variant="outline" className="text-xs">{r.ruleType}</Badge>
                    <Badge variant={r.applies ? "default" : "secondary"} className="text-xs">
                      {r.applies ? t("permissions.applies") : t("permissions.doesNotApply")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {result.matchingAcls.length > 0 && (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium">{t("permissions.matchingAcls")} ({result.matchingAcls.length})</p>
                {result.matchingAcls.map(a => (
                  <div key={a.id} className="flex items-center gap-2 text-sm">
                    <Badge variant={a.effect === "grant" ? "default" : "destructive"} className="text-xs">{a.effect}</Badge>
                    <span>{a.granteeType}: {a.granteeId.slice(0, 12)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
