import { db } from "@/db";
import { auditLogs } from "@/db/schema";

type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "login_failed"
  | "logout"
  | "register"
  | "verify_email"
  | "password_reset_request"
  | "password_reset"
  | "change_password"
  | "magic_link_request"
  | "magic_link_verify"
  | "resend_verification"
  | "vote"
  | "unvote"
  | "comment"
  | "project_comment"
  | "upload"
  | "bulk_update"
  | "bulk_delete"
  | "bulk_archive"
  | "oidc_login"
  | "oidc_register"
  | "request_email_change"
  | "change_email"
  | "add_member"
  | "remove_member";

type AuditEntity =
  | "project"
  | "proposal"
  | "vote"
  | "comment"
  | "user"
  | "invitation"
  | "session"
  | "attachment"
  | "tag"
  | "team";

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
