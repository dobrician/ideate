"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/lib/use-locale";
import { getCsrfTokenClient } from "@/lib/csrf-client";
import { Plus, Trash2, Clock, Calendar, GitBranch, Zap, ShieldCheck, ShieldOff } from "lucide-react";
import { ALL_PERMISSIONS } from "@/lib/rbac";
import {
  createPermissionRuleAction,
  deletePermissionRuleAction,
  updatePermissionRuleAction,
  createResourceAclAction,
  deleteResourceAclAction,
  type CreateRuleInput,
  type CreateAclInput,
} from "../permission-actions";

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

interface RuleRow {
  id: string;
  name: string;
  description: string | null;
  ruleType: string;
  targetType: string;
  targetId: string | null;
  permission: string;
  effect: string;
  startsAt: string | null;
  expiresAt: string | null;
  schedule: string | null;
  condition: string | null;
  entityType: string | null;
  entityId: string | null;
  active: boolean;
  createdBy: string | null;
  createdAt: string | null;
}

interface AclRow {
  id: string;
  entityType: string;
  entityId: string;
  granteeType: string;
  granteeId: string;
  permission: string;
  effect: string;
  expiresAt: string | null;
  grantedBy: string | null;
  reason: string | null;
  createdAt: string | null;
}

const RULE_TYPES = ["time_expiry", "schedule", "deadline", "condition"] as const;
const TARGET_TYPES = ["user", "role", "all"] as const;
const EFFECTS = ["grant", "deny"] as const;
const ROLES = ["admin", "manager", "member", "viewer"];

const ruleTypeIcons: Record<string, typeof Clock> = {
  time_expiry: Clock,
  schedule: Calendar,
  deadline: GitBranch,
  condition: Zap,
};

export function PermissionRuleManager({
  rules: initialRules,
  acls: initialAcls,
  users,
}: {
  rules: RuleRow[];
  acls: AclRow[];
  users: User[];
}) {
  const { t } = useLocale();
  const csrf = getCsrfTokenClient();
  const [isPending, startTransition] = useTransition();
  const [rules, setRules] = useState(initialRules);
  const [acls, setAcls] = useState(initialAcls);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [showAclForm, setShowAclForm] = useState(false);
  const [tab, setTab] = useState<"rules" | "acls">("rules");

  // ── Rule Form State ──
  const [ruleName, setRuleName] = useState("");
  const [ruleType, setRuleType] = useState<string>("time_expiry");
  const [targetType, setTargetType] = useState<string>("role");
  const [targetId, setTargetId] = useState("");
  const [rulePerm, setRulePerm] = useState<string>(ALL_PERMISSIONS[0]);
  const [ruleEffect, setRuleEffect] = useState<string>("grant");
  const [ruleExpiry, setRuleExpiry] = useState("");
  const [ruleSchedule, setRuleSchedule] = useState("");
  const [ruleCondition, setRuleCondition] = useState("");

  // ── ACL Form State ──
  const [aclEntityType, setAclEntityType] = useState<string>("project");
  const [aclEntityId, setAclEntityId] = useState("");
  const [aclGranteeType, setAclGranteeType] = useState<string>("user");
  const [aclGranteeId, setAclGranteeId] = useState("");
  const [aclPerm, setAclPerm] = useState<string>(ALL_PERMISSIONS[0]);
  const [aclEffect, setAclEffect] = useState<string>("grant");
  const [aclReason, setAclReason] = useState("");

  function handleCreateRule() {
    startTransition(async () => {
      const input: CreateRuleInput = {
        name: ruleName,
        ruleType: ruleType as CreateRuleInput["ruleType"],
        targetType: targetType as CreateRuleInput["targetType"],
        targetId: targetType !== "all" ? targetId : undefined,
        permission: rulePerm,
        effect: ruleEffect as "grant" | "deny",
        expiresAt: ruleExpiry ? new Date(ruleExpiry).getTime() : undefined,
        schedule: ruleType === "schedule" && ruleSchedule ? ruleSchedule : undefined,
        condition: ruleType === "condition" && ruleCondition ? ruleCondition : undefined,
      };
      const res = await createPermissionRuleAction(input, csrf);
      if (res && "success" in res && res.success) {
        setShowRuleForm(false);
        setRuleName("");
        setRuleExpiry("");
        // Reload would happen via revalidatePath, but add optimistic entry
        setRules(prev => [{
          id: "id" in res ? (res as { id: string }).id : "new",
          name: input.name,
          description: null,
          ruleType: input.ruleType,
          targetType: input.targetType,
          targetId: input.targetId || null,
          permission: input.permission,
          effect: input.effect,
          startsAt: null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt).toISOString() : null,
          schedule: input.schedule || null,
          condition: input.condition || null,
          entityType: null,
          entityId: null,
          active: true,
          createdBy: null,
          createdAt: new Date().toISOString(),
        }, ...prev]);
      }
    });
  }

  function handleDeleteRule(id: string) {
    startTransition(async () => {
      const res = await deletePermissionRuleAction(id, csrf);
      if (res && "success" in res) {
        setRules(prev => prev.filter(r => r.id !== id));
      }
    });
  }

  function handleToggleRule(id: string, active: boolean) {
    startTransition(async () => {
      const res = await updatePermissionRuleAction(id, { active: !active }, csrf);
      if (res && "success" in res) {
        setRules(prev => prev.map(r => r.id === id ? { ...r, active: !active } : r));
      }
    });
  }

  function handleCreateAcl() {
    startTransition(async () => {
      const input: CreateAclInput = {
        entityType: aclEntityType as "project" | "proposal",
        entityId: aclEntityId,
        granteeType: aclGranteeType as "user" | "role",
        granteeId: aclGranteeId,
        permission: aclPerm,
        effect: aclEffect as "grant" | "deny",
        reason: aclReason || undefined,
      };
      const res = await createResourceAclAction(input, csrf);
      if (res && "success" in res && res.success) {
        setShowAclForm(false);
        setAclEntityId("");
        setAclGranteeId("");
        setAclReason("");
        setAcls(prev => [{
          id: "id" in res ? (res as { id: string }).id : "new",
          entityType: input.entityType,
          entityId: input.entityId,
          granteeType: input.granteeType,
          granteeId: input.granteeId,
          permission: input.permission,
          effect: input.effect,
          expiresAt: null,
          grantedBy: null,
          reason: input.reason || null,
          createdAt: new Date().toISOString(),
        }, ...prev]);
      }
    });
  }

  function handleDeleteAcl(id: string) {
    startTransition(async () => {
      const res = await deleteResourceAclAction(id, csrf);
      if (res && "success" in res) {
        setAcls(prev => prev.filter(a => a.id !== id));
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Tab Selector */}
      <div className="flex gap-2">
        <Button variant={tab === "rules" ? "default" : "outline"} onClick={() => setTab("rules")}>
          {t("permissions.rules")} ({rules.length})
        </Button>
        <Button variant={tab === "acls" ? "default" : "outline"} onClick={() => setTab("acls")}>
          {t("permissions.acls")} ({acls.length})
        </Button>
      </div>

      {/* ── Permission Rules Tab ── */}
      {tab === "rules" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t("permissions.rules")}</CardTitle>
              <CardDescription>{t("permissions.rulesDesc")}</CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowRuleForm(!showRuleForm)}>
              <Plus className="mr-1.5 h-4 w-4" />{t("permissions.createRule")}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {showRuleForm && (
              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>{t("permissions.ruleName")}</Label>
                    <Input value={ruleName} onChange={e => setRuleName(e.target.value)} placeholder={t("permissions.ruleNamePlaceholder")} />
                  </div>
                  <div>
                    <Label>{t("permissions.ruleType")}</Label>
                    <select className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={ruleType} onChange={e => setRuleType(e.target.value)}>
                      {RULE_TYPES.map(rt => <option key={rt} value={rt}>{t(`permissions.ruleType_${rt}`)}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>{t("permissions.targetType")}</Label>
                    <select className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={targetType} onChange={e => setTargetType(e.target.value)}>
                      {TARGET_TYPES.map(tt => <option key={tt} value={tt}>{t(`permissions.targetType_${tt}`)}</option>)}
                    </select>
                  </div>
                  {targetType === "user" && (
                    <div>
                      <Label>{t("permissions.targetUser")}</Label>
                      <select className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={targetId} onChange={e => setTargetId(e.target.value)}>
                        <option value="">{t("permissions.selectUser")}</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
                      </select>
                    </div>
                  )}
                  {targetType === "role" && (
                    <div>
                      <Label>{t("permissions.targetRole")}</Label>
                      <select className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={targetId} onChange={e => setTargetId(e.target.value)}>
                        <option value="">{t("permissions.selectRole")}</option>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <Label>{t("permissions.permission")}</Label>
                    <select className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={rulePerm} onChange={e => setRulePerm(e.target.value)}>
                      {ALL_PERMISSIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>{t("permissions.effect")}</Label>
                    <select className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={ruleEffect} onChange={e => setRuleEffect(e.target.value)}>
                      {EFFECTS.map(e => <option key={e} value={e}>{t(`permissions.effect_${e}`)}</option>)}
                    </select>
                  </div>
                  {(ruleType === "time_expiry" || ruleType === "deadline") && (
                    <div>
                      <Label>{t("permissions.expiresAt")}</Label>
                      <Input type="datetime-local" value={ruleExpiry} onChange={e => setRuleExpiry(e.target.value)} />
                    </div>
                  )}
                  {ruleType === "schedule" && (
                    <div className="sm:col-span-2">
                      <Label>{t("permissions.schedule")}</Label>
                      <Input value={ruleSchedule} onChange={e => setRuleSchedule(e.target.value)} placeholder='{"days":[1,2,3,4,5],"startHour":9,"endHour":17}' />
                    </div>
                  )}
                  {ruleType === "condition" && (
                    <div className="sm:col-span-2">
                      <Label>{t("permissions.condition")}</Label>
                      <Input value={ruleCondition} onChange={e => setRuleCondition(e.target.value)} placeholder='{"type":"vote_count","operator":">=","value":10}' />
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreateRule} disabled={isPending || !ruleName.trim()}>
                    {isPending ? t("common.loading") : t("permissions.createRule")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowRuleForm(false)}>{t("common.cancel")}</Button>
                </div>
              </div>
            )}

            {rules.length === 0 && (
              <p className="text-center text-muted-foreground py-8">{t("permissions.noRules")}</p>
            )}

            {rules.map(rule => {
              const Icon = ruleTypeIcons[rule.ruleType] ?? Clock;
              const isExpired = rule.expiresAt && new Date(rule.expiresAt) < new Date();
              return (
                <div key={rule.id} className={`flex items-center justify-between rounded-lg border p-3 ${!rule.active || isExpired ? "opacity-60" : ""}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{rule.name}</span>
                        <Badge variant={rule.effect === "grant" ? "default" : "destructive"} className="text-xs">
                          {rule.effect === "grant" ? <ShieldCheck className="mr-1 h-3 w-3" /> : <ShieldOff className="mr-1 h-3 w-3" />}
                          {rule.effect}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{rule.permission}</Badge>
                        <Badge variant="secondary" className="text-xs">{rule.ruleType}</Badge>
                        {!rule.active && <Badge variant="secondary" className="text-xs">{t("permissions.inactive")}</Badge>}
                        {isExpired && <Badge variant="secondary" className="text-xs">{t("permissions.expired")}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("permissions.target")}: {rule.targetType}{rule.targetId ? ` (${rule.targetId})` : ""}
                        {rule.expiresAt && ` · ${t("permissions.expiresAt")}: ${new Date(rule.expiresAt).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => handleToggleRule(rule.id, rule.active)} disabled={isPending}>
                      {rule.active ? t("permissions.disable") : t("permissions.enable")}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteRule(rule.id)} disabled={isPending}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ── Resource ACLs Tab ── */}
      {tab === "acls" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t("permissions.acls")}</CardTitle>
              <CardDescription>{t("permissions.aclsDesc")}</CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowAclForm(!showAclForm)}>
              <Plus className="mr-1.5 h-4 w-4" />{t("permissions.createAcl")}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {showAclForm && (
              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>{t("permissions.entityType")}</Label>
                    <select className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={aclEntityType} onChange={e => setAclEntityType(e.target.value)}>
                      <option value="project">{t("permissions.entityProject")}</option>
                      <option value="proposal">{t("permissions.entityProposal")}</option>
                    </select>
                  </div>
                  <div>
                    <Label>{t("permissions.entityId")}</Label>
                    <Input value={aclEntityId} onChange={e => setAclEntityId(e.target.value)} placeholder={t("permissions.entityIdPlaceholder")} />
                  </div>
                  <div>
                    <Label>{t("permissions.granteeType")}</Label>
                    <select className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={aclGranteeType} onChange={e => setAclGranteeType(e.target.value)}>
                      <option value="user">{t("permissions.granteeUser")}</option>
                      <option value="role">{t("permissions.granteeRole")}</option>
                    </select>
                  </div>
                  <div>
                    <Label>{t("permissions.granteeId")}</Label>
                    {aclGranteeType === "user" ? (
                      <select className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={aclGranteeId} onChange={e => setAclGranteeId(e.target.value)}>
                        <option value="">{t("permissions.selectUser")}</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
                      </select>
                    ) : (
                      <select className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={aclGranteeId} onChange={e => setAclGranteeId(e.target.value)}>
                        <option value="">{t("permissions.selectRole")}</option>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    )}
                  </div>
                  <div>
                    <Label>{t("permissions.permission")}</Label>
                    <select className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={aclPerm} onChange={e => setAclPerm(e.target.value)}>
                      {ALL_PERMISSIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>{t("permissions.effect")}</Label>
                    <select className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={aclEffect} onChange={e => setAclEffect(e.target.value)}>
                      {EFFECTS.map(e => <option key={e} value={e}>{t(`permissions.effect_${e}`)}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label>{t("permissions.reason")}</Label>
                    <Input value={aclReason} onChange={e => setAclReason(e.target.value)} placeholder={t("permissions.reasonPlaceholder")} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreateAcl} disabled={isPending || !aclEntityId.trim() || !aclGranteeId.trim()}>
                    {isPending ? t("common.loading") : t("permissions.createAcl")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAclForm(false)}>{t("common.cancel")}</Button>
                </div>
              </div>
            )}

            {acls.length === 0 && (
              <p className="text-center text-muted-foreground py-8">{t("permissions.noAcls")}</p>
            )}

            {acls.map(acl => (
              <div key={acl.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={acl.effect === "grant" ? "default" : "destructive"} className="text-xs">
                      {acl.effect}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{acl.permission}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {acl.entityType}/{acl.entityId.slice(0, 8)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {acl.granteeType}: {acl.granteeId.slice(0, 12)}{acl.reason ? ` · ${acl.reason}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="ghost" className="text-destructive shrink-0" onClick={() => handleDeleteAcl(acl.id)} disabled={isPending}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
