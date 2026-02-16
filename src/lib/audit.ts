import { db } from "@/db";
import { auditLogs } from "@/db/schema";

type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "vote"
  | "unvote"
  | "comment"
  | "project_comment";

type AuditEntity =
  | "project"
  | "proposal"
  | "vote"
  | "comment"
  | "user"
  | "session";

interface AuditEntry {
  userId: string | null;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  details?: string;
  ipAddress?: string;
}

/**
 * Log an auditable user action. Fire-and-forget: never throws.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: entry.userId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      details: entry.details ?? null,
      ipAddress: entry.ipAddress ?? null,
    });
  } catch {
    // Audit logging should never break application flow
  }
}
