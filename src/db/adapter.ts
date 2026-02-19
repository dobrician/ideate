/**
 * Unified database adapter.
 * Re-exports `db` and `DB` from the correct backend based on DATABASE_DRIVER.
 * Consumers that need to support both databases should import from here.
 *
 * Default: SQLite (src/db/index.ts)
 * When DATABASE_DRIVER=postgresql: PostgreSQL (src/db/pg.ts)
 */

export function getDatabaseDriver(): "sqlite" | "postgresql" {
  const driver = process.env.DATABASE_DRIVER ?? "sqlite";
  if (driver !== "sqlite" && driver !== "postgresql") {
    throw new Error(`Invalid DATABASE_DRIVER: ${driver}. Must be "sqlite" or "postgresql".`);
  }
  return driver;
}

/**
 * Returns true when the app is configured to use PostgreSQL.
 */
export function isPostgresql(): boolean {
  return getDatabaseDriver() === "postgresql";
}
