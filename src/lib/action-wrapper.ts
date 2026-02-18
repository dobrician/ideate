import { requireAuth } from "@/lib/auth";
import { requireCsrfToken } from "@/lib/csrf";
import { hasPermission } from "@/lib/rbac";
import type { Role, Permission } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getActionClientIp } from "@/lib/request-utils";
import { logger } from "@/lib/logger";
import type { users } from "@/db/schema";

type User = typeof users.$inferSelect;

export interface ActionAuthOptions {
  permission?: Permission;
  rateLimitKey?: string;
  rateLimitMax?: number;
  rateLimitWindow?: number;
}

export type ActionError = { error: string; success?: false };

/**
 * Wrapper for server actions that centralizes CSRF, auth, rate limiting,
 * permission checks, and error handling.
 *
 * - CSRF token is always validated first
 * - Auth is always required
 * - Rate limiting is optional (omit rateLimitKey to skip)
 * - Permission check is optional (omit permission to skip)
 * - NEXT_REDIRECT and Forbidden errors are properly propagated
 */
export async function withActionAuth<T>(
  csrfToken: string,
  options: ActionAuthOptions,
  handler: (user: User) => Promise<T>,
): Promise<T | ActionError> {
  try {
    await requireCsrfToken(csrfToken);
    const user = await requireAuth();

    if (options.rateLimitKey) {
      const ip = await getActionClientIp();
      const rl = checkRateLimit(
        `${options.rateLimitKey}:${ip}`,
        options.rateLimitMax ?? 20,
        options.rateLimitWindow ?? 15 * 60_000,
      );
      if (!rl.allowed) {
        return { error: "error.tooManyRequests" };
      }
    }

    if (options.permission && !hasPermission(user.role as Role, options.permission)) {
      return { error: "error.noPermission" };
    }

    return await handler(user);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { error: "error.mustBeLoggedIn" };
    }
    if (error instanceof Error && error.message.startsWith("Forbidden:")) {
      return { error: error.message };
    }
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
      throw error;
    }
    logger.error({ err: error }, "Action error");
    return { error: "error.unexpected" };
  }
}
