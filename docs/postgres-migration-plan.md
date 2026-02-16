# PostgreSQL Migration Plan

Analysis of what needs to change to switch from SQLite to PostgreSQL with Drizzle ORM.

> **Status:** Spike / analysis only. No migration has been performed.

---

## Affected Files (21 total)

### Core Database Layer (HIGH effort)

#### `src/db/schema.ts`
- Replace `import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core"` with `import { pgTable, text, integer, boolean, timestamp, primaryKey } from "drizzle-orm/pg-core"`
- Replace all `sqliteTable(...)` calls with `pgTable(...)`
- Replace `integer("...", { mode: "boolean" })` with `boolean("...")` (affects `emailVerified`, `isNegativeInitiative`)
- Replace `integer("...", { mode: "timestamp" })` with `timestamp("...")` (affects `createdAt`, `updatedAt`, `deadline`, `verificationTokenExpires`, `resetTokenExpires`)
- Replace all `` sql`(unixepoch())` `` defaults with `` sql`now()` `` (10 occurrences)
- Consider using `uuid("id").defaultRandom()` instead of `text("id")` with `randomUUID()`
- Consider PostgreSQL `CREATE TYPE ... AS ENUM` for `role` and `status` columns via Drizzle's `pgEnum()`

#### `src/db/index.ts`
- Remove `import Database from "better-sqlite3"` and `import { drizzle } from "drizzle-orm/better-sqlite3"`
- Add `import { drizzle } from "drizzle-orm/node-postgres"` and `import { Pool } from "pg"`
- Replace `new Database(DB_PATH)` with `new Pool({ connectionString: DATABASE_URL })`
- Remove all three `sqlite.pragma(...)` calls (WAL, busy_timeout, foreign_keys) — PostgreSQL handles these natively
- Replace or remove the custom `applyMigrations()` function — use Drizzle Kit's `migrate()` function or `drizzle-kit migrate` CLI
- The `_migrations` table uses `unixepoch()` — will be replaced by Drizzle's built-in migration tracker
- Update `DATABASE_URL` default from `"data/ideate.db"` to `"postgresql://localhost:5432/ideate"`

#### `src/lib/search.ts` (FULL REWRITE)
- Remove all `better-sqlite3` imports and direct SQLite connections
- Replace FTS5 virtual tables (`projects_fts`, `proposals_fts`) with PostgreSQL `tsvector` columns + GIN indexes
- Replace `MATCH` operator with `@@` (tsquery)
- Replace `snippet()` function with `ts_headline()`
- Replace `rank` pseudo-column with `ts_rank()`
- Replace `rebuildSearchIndex()` from FTS5 content rebuild to `UPDATE ... SET search_vector = to_tsvector('english', ...)`
- The fallback LIKE search logic is portable but needs driver changes

### Migrations (regenerate all)

All migration files under `drizzle/` must be regenerated from scratch via `drizzle-kit generate` after updating the schema. Key changes:

#### `drizzle/0000_secret_kree.sql`
- All `DEFAULT (unixepoch())` become `DEFAULT now()`
- Backtick identifiers become double-quote identifiers
- `integer ... DEFAULT false` becomes `boolean ... DEFAULT false`
- Timestamp integers become `timestamp` columns

#### `drizzle/0001_sprint5_audit_search.sql`
- Most impactful: `CREATE VIRTUAL TABLE ... USING fts5(...)` has no PostgreSQL equivalent
- Replace with: `ALTER TABLE projects ADD COLUMN search_vector tsvector`
- Add GIN index: `CREATE INDEX ... USING GIN (search_vector)`
- Replace FTS5 sync triggers with PostgreSQL trigger functions using `to_tsvector()`

#### `drizzle/0002_sprint7_indexes.sql`
- Standard `CREATE INDEX` syntax — largely portable as-is

#### `drizzle/0003_sprint9_password_auth.sql`
- `INTEGER` boolean/timestamp columns become `BOOLEAN`/`TIMESTAMP`

#### `drizzle/0004_sprint13_indexes.sql`
- Already portable, no changes needed

#### `drizzle/meta/_journal.json`
- `"dialect": "sqlite"` must become `"postgresql"`
- Will be regenerated automatically

### Configuration (LOW effort)

#### `drizzle.config.ts`
- `dialect: "sqlite"` -> `dialect: "postgresql"`
- `dbCredentials: { url: "data/ideate.db" }` -> `dbCredentials: { connectionString: process.env.DATABASE_URL }`

#### `.env.example`
- `DATABASE_URL=data/ideate.db` -> `DATABASE_URL=postgresql://ideate:password@localhost:5432/ideate`

#### `package.json`
- Remove: `better-sqlite3`, `@types/better-sqlite3`
- Add: `pg`, `@types/pg` (or use `postgres` package with `drizzle-orm/postgres-js`)

### Infrastructure (MEDIUM effort)

#### `docker-compose.yml`
- Add a `postgres` service (e.g., `postgres:16-alpine`)
- Change `DATABASE_URL` env var to PostgreSQL connection string
- Remove `/app/data` volume mounts (no SQLite file)
- Add `depends_on: postgres` to app services
- Add `pgdata` named volume for PostgreSQL persistence

#### `Dockerfile`
- Remove `mkdir -p data` from both builder and runner stages
- Optionally add `libpq` if using `pg` with native bindings

#### `scripts/backup.sh`
- Replace `sqlite3 ... '.backup ...'` with `pg_dump -Fc`
- Remove WAL checkpoint pragma
- Remove `.db` file references

#### `scripts/restore.sh`
- Replace file copy with `pg_restore -d ideate backup.dump`
- Remove `sqlite3 ... "PRAGMA integrity_check"` — use `pg_restore --list` or `psql -c "SELECT 1"`
- Remove WAL/SHM cleanup

### API Routes (MEDIUM effort)

#### `src/app/api/health/route.ts`
- Remove `import Database from "better-sqlite3"` and file-path logic
- Replace `sqlite.pragma("quick_check")` with `db.execute(sql\`SELECT 1\`)` via Drizzle
- Remove `mkdirSync` directory creation

### Tests (MEDIUM effort)

#### `tests/setup.ts`
- Remove `process.env.DATABASE_URL = ":memory:"` — PostgreSQL has no in-memory mode
- Options: mock `db` module (already done in most tests), use `pg-mem` for in-memory PG, or point to a test database

#### `tests/unit/search.test.ts`
- Full rewrite: mock `pg` pool instead of `better-sqlite3`
- Remove pragma assertions
- Update FTS assertions to match PostgreSQL `tsquery`/`ts_headline()` behavior

#### `tests/unit/db-schema.test.ts`
- No changes needed (only checks exports exist)

### Files That Need No Changes

- `src/app/dashboard/queries.ts` — `sql\`(SELECT 1)\`` works in PostgreSQL
- `src/app/admin/page.tsx` — raw SQL joins are standard SQL
- All other `src/lib/` files — use Drizzle ORM abstraction, no direct SQLite access
- All other test files — mock the `db` module, no direct SQLite dependency

---

## Potential Issues

1. **Full-text search rewrite** — The FTS5 -> tsvector migration is the biggest risk. PostgreSQL FTS is powerful but has different semantics (stemming, language config, ranking algorithms). Need to test search quality.

2. **Timestamp storage** — SQLite stores timestamps as Unix epoch integers. PostgreSQL uses native `timestamp` type. All application code that does `new Date(timestamp).getTime()` comparisons (e.g., `isDeadlinePassed()` in `actions.ts:28`) should still work since Drizzle handles the conversion, but needs verification.

3. **Boolean storage** — SQLite uses 0/1 integers for booleans. PostgreSQL uses native `true/false`. Drizzle handles this transparently, but verify edge cases in raw SQL queries.

4. **UUID generation** — Currently uses `randomUUID()` in schema defaults. PostgreSQL has `gen_random_uuid()` built-in. Consider using `uuid("id").defaultRandom()` from Drizzle PG.

5. **Concurrent writes** — SQLite's `busy_timeout` and WAL mode were configured for write contention. PostgreSQL handles concurrency natively with MVCC. Remove the pragmas and trust PostgreSQL's concurrency model.

6. **Transaction semantics** — SQLite has database-level locking. PostgreSQL has row-level locking. This is an improvement but verify that the `onConflictDoUpdate` upsert in `castVote` works identically.

7. **Data migration** — Need a one-time data migration script to export from SQLite and import into PostgreSQL. Consider using `pgloader` or a custom script with CSV export/import.

8. **Test environment** — The `:memory:` SQLite database used in tests has no PostgreSQL equivalent. Options: `pg-mem` (in-memory PG emulation), a dedicated test database, or continue with module mocking (current approach for most tests).

9. **CI/CD** — GitHub Actions CI will need a PostgreSQL service container. Add `services: postgres: image: postgres:16-alpine` to the CI workflow.

10. **Deployment** — Need to provision a PostgreSQL instance (managed: Neon, Supabase, RDS; or self-hosted in Docker). The current SQLite file-based approach requires no external service.

---

## Migration Strategy

### Phase 1: Schema + Driver Swap
1. Update `src/db/schema.ts` (sqliteTable -> pgTable, types)
2. Update `src/db/index.ts` (better-sqlite3 -> pg)
3. Update `drizzle.config.ts` (dialect, credentials)
4. Regenerate all migrations with `drizzle-kit generate`
5. Update `package.json` dependencies
6. Run `npx tsc --noEmit` to find all type errors

### Phase 2: Search Rewrite
1. Rewrite `src/lib/search.ts` for PostgreSQL tsvector/tsquery
2. Add tsvector columns and GIN indexes to schema
3. Create PostgreSQL trigger functions for search index sync
4. Update search tests

### Phase 3: Infrastructure
1. Update `docker-compose.yml` with PostgreSQL service
2. Update `Dockerfile` (remove data dir creation)
3. Rewrite backup/restore scripts for pg_dump/pg_restore
4. Update health check endpoint
5. Update `.env.example` and environment documentation

### Phase 4: Testing + Data Migration
1. Update test setup and search test mocks
2. Write data migration script (SQLite -> PostgreSQL)
3. Run full test suite against PostgreSQL
4. Update CI/CD with PostgreSQL service container

### Phase 5: Deployment
1. Provision PostgreSQL instance
2. Run data migration
3. Deploy updated application
4. Verify with smoke tests
5. Remove SQLite dependencies and files

---

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1: Schema + Driver | 2-3 hours |
| Phase 2: Search Rewrite | 3-4 hours |
| Phase 3: Infrastructure | 1-2 hours |
| Phase 4: Testing + Data | 2-3 hours |
| Phase 5: Deployment | 1-2 hours |
| **Total** | **9-14 hours** |
