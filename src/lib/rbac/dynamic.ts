/**
 * Dynamic permission evaluation engine.
 *
 * Extends the static RBAC system with:
 * - Time-based rules (expiry, schedules, deadline-driven)
 * - Conditional rules (vote thresholds, authorship windows)
 * - Per-resource ACLs (fine-grained grant/deny per entity)
 *
 * Evaluation order (first match wins within each layer):
 * 1. Resource ACL deny → immediate deny
 * 2. Permission rule deny → deny
 * 3. Resource ACL grant → grant
 * 4. Permission rule grant → grant
 * 5. Fall through to static RBAC
 */

import { db } from "@/db";
import { permissionRules, resourceAcls } from "@/db/schema";
import { eq, and, or, isNull, lte, gte } from "drizzle-orm";
import { hasPermission, type Permission, type Role, BUILT_IN_ROLES } from "@/lib/rbac";

// ─── Types ──────────────────────────────────────────────────────────────

export interface PermissionContext {
  userId: string;
  userRole: string;
  permission: Permission;
  entityType?: "project" | "proposal";
  entityId?: string;
  /** Extra context for condition evaluation */
  voteCount?: number;
  /** Resource creation timestamp (epoch seconds) for authorship windows */
  resourceCreatedAt?: number;
  /** Resource owner ID for author-based conditions */
  resourceOwnerId?: string;
}

export interface ScheduleConfig {
  days: number[]; // 0=Sunday .. 6=Saturday
  startHour: number; // 0-23
  endHour: number; // 0-23
  timezone?: string; // IANA timezone, defaults to UTC
}

export interface ConditionConfig {
  type: "vote_count" | "authorship_window" | "custom";
  operator: ">=" | "<=" | ">" | "<" | "==" ;
  value: number;
}

type RuleRow = typeof permissionRules.$inferSelect;
type AclRow = typeof resourceAcls.$inferSelect;

// ─── Rule Loading ───────────────────────────────────────────────────────

/**
 * Fetch active permission rules that could apply to a given user/role.
 */
export async function getApplicableRules(
  userId: string,
  userRole: string,
): Promise<RuleRow[]> {
  const now = new Date();
  const rows = await db
    .select()
    .from(permissionRules)
    .where(
      and(
        eq(permissionRules.active, true),
        or(
          isNull(permissionRules.startsAt),
          lte(permissionRules.startsAt, now),
        ),
        or(
          isNull(permissionRules.expiresAt),
          gte(permissionRules.expiresAt, now),
        ),
        or(
          and(eq(permissionRules.targetType, "user"), eq(permissionRules.targetId, userId)),
          and(eq(permissionRules.targetType, "role"), eq(permissionRules.targetId, userRole)),
          eq(permissionRules.targetType, "all"),
        ),
      ),
    );
  return rows;
}

/**
 * Fetch resource ACLs for a specific entity.
 */
export async function getResourceAcls(
  entityType: string,
  entityId: string,
  userId: string,
  userRole: string,
): Promise<AclRow[]> {
  const now = new Date();
  const rows = await db
    .select()
    .from(resourceAcls)
    .where(
      and(
        eq(resourceAcls.entityType, entityType as "project" | "proposal"),
        eq(resourceAcls.entityId, entityId),
        or(
          isNull(resourceAcls.expiresAt),
          gte(resourceAcls.expiresAt, now),
        ),
        or(
          and(eq(resourceAcls.granteeType, "user"), eq(resourceAcls.granteeId, userId)),
          and(eq(resourceAcls.granteeType, "role"), eq(resourceAcls.granteeId, userRole)),
        ),
      ),
    );
  return rows;
}

// ─── Condition Evaluation ───────────────────────────────────────────────

/**
 * Check if a schedule-based rule is currently active.
 */
export function isScheduleActive(schedule: ScheduleConfig): boolean {
  const tz = schedule.timezone ?? "UTC";
  let now: Date;
  try {
    now = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
  } catch {
    now = new Date();
  }
  const day = now.getDay();
  const hour = now.getHours();

  if (!schedule.days.includes(day)) return false;

  if (schedule.startHour <= schedule.endHour) {
    return hour >= schedule.startHour && hour < schedule.endHour;
  }
  // Overnight schedule (e.g., 22-06)
  return hour >= schedule.startHour || hour < schedule.endHour;
}

/**
 * Evaluate a condition against the permission context.
 */
export function evaluateCondition(
  condition: ConditionConfig,
  ctx: PermissionContext,
): boolean {
  let actual: number;

  switch (condition.type) {
    case "vote_count":
      actual = ctx.voteCount ?? 0;
      break;
    case "authorship_window": {
      // value is window in hours; check if current user is owner and within window
      if (!ctx.resourceOwnerId || ctx.resourceOwnerId !== ctx.userId) return false;
      if (!ctx.resourceCreatedAt) return false;
      const nowSec = Math.floor(Date.now() / 1000);
      const elapsedHours = (nowSec - ctx.resourceCreatedAt) / 3600;
      actual = elapsedHours;
      break;
    }
    default:
      return false;
  }

  switch (condition.operator) {
    case ">=": return actual >= condition.value;
    case "<=": return actual <= condition.value;
    case ">": return actual > condition.value;
    case "<": return actual < condition.value;
    case "==": return actual === condition.value;
    default: return false;
  }
}

// ─── Rule Evaluation ────────────────────────────────────────────────────

/**
 * Check if a single rule applies in the current context.
 */
export function doesRuleApply(rule: RuleRow, ctx: PermissionContext): boolean {
  // Permission must match
  if (rule.permission !== ctx.permission) return false;

  // Entity scope check
  if (rule.entityType && rule.entityId) {
    if (ctx.entityType !== rule.entityType || ctx.entityId !== rule.entityId) {
      return false;
    }
  }

  // Schedule check
  if (rule.ruleType === "schedule" && rule.schedule) {
    try {
      const sched = JSON.parse(rule.schedule) as ScheduleConfig;
      if (!isScheduleActive(sched)) return false;
    } catch {
      return false;
    }
  }

  // Condition check
  if (rule.ruleType === "condition" && rule.condition) {
    try {
      const cond = JSON.parse(rule.condition) as ConditionConfig;
      if (!evaluateCondition(cond, ctx)) return false;
    } catch {
      return false;
    }
  }

  return true;
}

// ─── Main Evaluation ────────────────────────────────────────────────────

/**
 * Evaluate permission dynamically considering all rule layers.
 *
 * Returns { allowed, reason, ruleId? } with explanation.
 */
export async function evaluatePermission(ctx: PermissionContext): Promise<{
  allowed: boolean;
  reason: string;
  ruleId?: string;
}> {
  // 1. Check resource ACLs if entity context provided
  if (ctx.entityType && ctx.entityId) {
    const acls = await getResourceAcls(ctx.entityType, ctx.entityId, ctx.userId, ctx.userRole);

    // ACL deny takes highest priority
    const deny = acls.find(a => a.permission === ctx.permission && a.effect === "deny");
    if (deny) {
      return { allowed: false, reason: "Denied by resource ACL", ruleId: deny.id };
    }

    // ACL grant
    const grant = acls.find(a => a.permission === ctx.permission && a.effect === "grant");
    if (grant) {
      return { allowed: true, reason: "Granted by resource ACL", ruleId: grant.id };
    }
  }

  // 2. Check dynamic permission rules
  const rules = await getApplicableRules(ctx.userId, ctx.userRole);

  // Deny rules first
  const denyRule = rules.find(r => r.effect === "deny" && doesRuleApply(r, ctx));
  if (denyRule) {
    return { allowed: false, reason: `Denied by rule: ${denyRule.name}`, ruleId: denyRule.id };
  }

  // Grant rules
  const grantRule = rules.find(r => r.effect === "grant" && doesRuleApply(r, ctx));
  if (grantRule) {
    return { allowed: true, reason: `Granted by rule: ${grantRule.name}`, ruleId: grantRule.id };
  }

  // 3. Fall through to static RBAC
  if (BUILT_IN_ROLES.includes(ctx.userRole as Role)) {
    const allowed = hasPermission(ctx.userRole as Role, ctx.permission);
    return { allowed, reason: allowed ? "Allowed by role" : "Denied by role" };
  }

  return { allowed: false, reason: "No matching rule or role" };
}

/**
 * Simple boolean check wrapping evaluatePermission.
 */
export async function hasDynamicPermission(ctx: PermissionContext): Promise<boolean> {
  const result = await evaluatePermission(ctx);
  return result.allowed;
}

// ─── Simulation ─────────────────────────────────────────────────────────

/**
 * Simulate permission evaluation for a given context without side effects.
 * Returns detailed breakdown of all matching rules.
 */
export async function simulatePermission(ctx: PermissionContext): Promise<{
  finalResult: { allowed: boolean; reason: string; ruleId?: string };
  matchingRules: Array<{ id: string; name: string; effect: string; ruleType: string; applies: boolean }>;
  matchingAcls: Array<{ id: string; effect: string; granteeType: string; granteeId: string }>;
  staticRbac: boolean;
}> {
  const staticRbac = BUILT_IN_ROLES.includes(ctx.userRole as Role)
    ? hasPermission(ctx.userRole as Role, ctx.permission)
    : false;

  const rules = await getApplicableRules(ctx.userId, ctx.userRole);
  const matchingRules = rules
    .filter(r => r.permission === ctx.permission)
    .map(r => ({
      id: r.id,
      name: r.name,
      effect: r.effect,
      ruleType: r.ruleType,
      applies: doesRuleApply(r, ctx),
    }));

  let matchingAcls: Array<{ id: string; effect: string; granteeType: string; granteeId: string }> = [];
  if (ctx.entityType && ctx.entityId) {
    const acls = await getResourceAcls(ctx.entityType, ctx.entityId, ctx.userId, ctx.userRole);
    matchingAcls = acls
      .filter(a => a.permission === ctx.permission)
      .map(a => ({
        id: a.id,
        effect: a.effect,
        granteeType: a.granteeType,
        granteeId: a.granteeId,
      }));
  }

  const finalResult = await evaluatePermission(ctx);

  return { finalResult, matchingRules, matchingAcls, staticRbac };
}
