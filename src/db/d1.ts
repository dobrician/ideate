/**
 * Cloudflare D1 database adapter for Ideate.
 *
 * This module provides the same `db` export as `./index.ts` but uses
 * Cloudflare D1 instead of better-sqlite3. It is used when the app
 * is deployed to Cloudflare Pages.
 *
 * Usage:
 *   - Set DEPLOY_TARGET=cloudflare in wrangler.toml or env
 *   - D1 binding named "DB" must be configured in wrangler.toml
 *   - Migrations are applied via `wrangler d1 migrations apply`
 *     (not at runtime like the Node.js adapter)
 *
 * The Drizzle schema is fully compatible — only the driver changes.
 */

import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import * as schema from "./schema";

export type CloudflareEnv = {
  DB: D1Database;
  UPLOADS: R2Bucket;
  RATE_LIMIT: KVNamespace;
};

/**
 * Create a Drizzle ORM instance from a Cloudflare D1 binding.
 * Call this in each request handler, passing the D1 binding from
 * the Cloudflare environment.
 *
 * @example
 *   const db = createD1Database(env.DB);
 *   const users = await db.select().from(schema.users);
 */
export function createD1Database(d1: D1Database) {
  return drizzleD1(d1, { schema });
}

export type D1DB = ReturnType<typeof createD1Database>;
