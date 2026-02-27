# Sprint 58 — AI Lifecycle Management & CI Recovery

**Date:** 2026-02-27
**Status:** COMPLETE
**Focus:** AI feedback, model registry, insight generation, smart notifications, CI build recovery

## Goals

- [x] **Goal 1: AI Feedback System** — Migration `drizzle/0029_sprint58_ai_lifecycle.sql` with `ai_feedback` table (4 indexes). Schema in `src/db/schema.ts` and `src/db/schema-pg.ts` supporting 5 features (routing, conflicts, deadlines, predictions, suggestions), 3 feedback types (rating, thumbs, correction), model version tracking.
- [x] **Goal 2: AI Model Registry** — `ai_models` table with provider/version/accuracy/status tracking. Admin UI at `src/app/admin/ai-models/page.tsx` with server queries, loading skeleton, and model management. Server actions in `src/app/admin/ai-actions.ts`.
- [x] **Goal 3: Automated Insight Generation** — `ai_insights` table with 4 insight types (trend, bottleneck, recommendation, anomaly) and 3 severity levels. Engine at `src/lib/ai/insights.ts` with 3 detectors: stalled proposals, declining engagement, activity trends. Job queue integration via `src/lib/queue`.
- [x] **Goal 4: Smart Notification System** — `notification_channel_prefs` table with per-user per-channel per-category preferences. Engine at `src/lib/ai/notifications.ts` with upsert preferences, delivery checks, importance scoring (0-100), and digest generation.
- [x] **Goal 5: CI Build Recovery** — Fixed server-only DB module leaking into client bundle via `@/lib/rbac` import chain. Extracted client-safe constants to `src/lib/rbac/permissions.ts`. All CI gates green (lint, typecheck, 1963 tests, build, smoke, E2E, Docker).

## Outcomes

- 1 commit (AI lifecycle + CI fix)
- 1963 tests passing, 142 test files
- Lint and typecheck clean
- New files: 3 AI modules (insights, learning, notifications), model admin UI (page, queries, loading), AI server actions, migration SQL, rbac/permissions.ts
- Modified: schema.ts + schema-pg.ts (4 new tables each), rbac.ts (re-export from permissions.ts), next.config.ts (+better-sqlite3 external), 2 client components (import path fix)

## Audit Results

### CI Build Failure — Root Cause Analysis

**Symptom:** GitHub CI Build step failed with `Module not found: Can't resolve 'fs'` in client bundle.

**Import chain causing the failure:**
```
permission-rule-manager.tsx ("use client")
  -> import { ALL_PERMISSIONS } from "@/lib/rbac"
    -> rbac.ts contains loadCustomRoles() with dynamic import("@/db")
      -> src/db/index.ts imports better-sqlite3, fs, path
        -> Bundler tries to include Node.js modules in browser bundle
```

**Contributing factors:**
1. `rbac.ts` mixed client-safe constants (`ALL_PERMISSIONS`, `Permission` type) with server-only DB logic (`loadCustomRoles()`) in a single module
2. `better-sqlite3` not listed in `serverExternalPackages` in `next.config.ts`
3. New Sprint 58 schema added duplicate `notificationPreferences` export (same name as existing Sprint 9 table, different schema)
4. `src/lib/ai/insights.ts` referenced non-existent `proposals.status` column

**Fixes applied:**
1. Created `src/lib/rbac/permissions.ts` with client-safe types and constants only (no server imports)
2. Updated `rbac.ts` to re-export from permissions.ts; marked as server-only
3. Changed 2 client components to import from `@/lib/rbac/permissions` instead of `@/lib/rbac`
4. Added `better-sqlite3` to `serverExternalPackages` in `next.config.ts`
5. Renamed duplicate schema export to `notificationChannelPrefs` (table: `notification_channel_prefs`)
6. Removed invalid `proposals.status` filter in AI insights detector

### Architecture / Code Quality
- Client/server boundary now enforced: `rbac/permissions.ts` is the client-safe entry point
- `rbac.ts` header comment documents that it must not be imported from "use client" components
- AI modules follow existing patterns: server actions with `"use server"`, DB imports in server-only files
- Notification channel prefs table properly distinguished from original simple prefs table
- Schema parity maintained between SQLite and PostgreSQL

### Security
- AI feedback stores user-provided corrections separately from AI output (no mixing)
- Model registry tracks deployment timestamps for auditability
- Notification preferences scoped per-user with foreign key cascade on delete
- All AI server actions use existing `withActionAuth` pattern

### Performance
- Migration includes indexes on: ai_feedback(feature, user_id, entity, rating), ai_models(feature+status), ai_insights(project+status, type+severity), notification_channel_prefs(user_id)
- Insight detectors use LIMIT clauses and targeted date range filters
- Notification scoring is pure computation (no DB calls)

## Notes
- Cloudflare Pages Deploy failure is pre-existing (also fails on last known-green CI run) and not a required check
- The `notification_preferences` (Sprint 9, simple boolean flags) and `notification_channel_prefs` (Sprint 58, per-channel-category) serve different purposes and coexist
- AI insight detectors are server-only and run via job queue; no client-side AI processing
- The `proposals` table lacks a `status` column; stalled proposal detection uses age + vote count heuristic instead
