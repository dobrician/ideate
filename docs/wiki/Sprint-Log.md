# Sprint Log

Reverse chronological. Click each sprint for full details.

---

### CI Incident Audit — 2026-02-27 (Sprint 69 post-release E2E failures)

| Field | Detail |
|-------|--------|
| **Failing runs** | [#22502059369](https://github.com/dobrician/ideate/actions/runs/22502059369) through [#22503697586](https://github.com/dobrician/ideate/actions/runs/22503697586) (4 consecutive failures) |
| **Failed job** | E2E Tests — parse error blocked all 183 tests, then 2-6 test failures after parse fix |
| **Root causes** | 1. `mobile-nav.test.ts` used `test.use({ ...devices["Pixel 5"] })` inside `test.describe()`, spreading the worker-scoped `defaultBrowserType` property which Playwright forbids inside describe blocks. This prevented ALL E2E tests from running. 2. Once parse error was fixed, 6 latent test bugs surfaced: (a) `.or()` locator pattern with `.first()` caused strict mode violations when both operands matched elements; (b) `getByText(/E2E Test Project/)` without `.first()` matched 12 accumulated seed projects; (c) `getByLabel(/mobile/i).first()` matched the header's "Mobile page links" nav (40px links) instead of the bottom MobileNav (44px links); (d) header mobile nav links were 40px, below the 44px WCAG AAA touch target; (e) project click used `getByText` matching a `<div>` instead of `getByRole("link")`; (f) admin page check on mobile matched hidden desktop nav elements. |
| **Fixes** | 4 commits: `83883a0` (strip defaultBrowserType), `5abf80d` (strict mode + touch target fixes), `329af08` (correct nav selector + project click), `d120bf8` (mobile nav stabilization). Also fixed header.tsx mobile links to meet 44px WCAG AAA. |
| **Verification** | Run [#22504034441](https://github.com/dobrician/ideate/actions/runs/22504034441) — all 7 jobs green (Lint, Type Check, Unit Tests, Build, Smoke Tests, E2E Tests, Docker Push). 170 passed, 2 flaky, 9 skipped, 0 failed. |
| **Preventive rules** | 1. Never spread raw `devices[...]` inside `test.describe()` — always destructure out `defaultBrowserType` first (see `mobile.test.ts` for the correct pattern). 2. Never use `.or()` with Playwright locators when both operands could match visible elements — use URL/content checks instead. 3. Always use `.first()` on locators that could match multiple elements from seed data. 4. Scope mobile nav test selectors to specific `aria-label` values (e.g., `/mobile navigation/i`) to avoid ambiguity between header and bottom nav. 5. Use `waitForURL()` instead of checking `page.url()` after click for reliable navigation assertions. |

---

### CI Incident Audit — 2026-02-27 (E2E strict mode + rate limit)

| Field | Detail |
|-------|--------|
| **Run** | [#22486596620](https://github.com/dobrician/ideate/actions/runs/22486596620) |
| **Failed job** | E2E Tests — 1 hard failure, 2 flaky |
| **Root cause** | Sprint 62 added `MobileNav` bottom bar (`src/components/mobile-nav.tsx`) with `aria-label="Mobile navigation"`, but the existing header component (`src/components/header.tsx:170`) already had an inline mobile nav with the same aria-label. Playwright strict mode rejected `getByLabel('Mobile navigation')` resolving to 2 elements. Secondary: dashboard E2E tests hit the 5-per-email login rate limit (429) because `seedTestData` was called once in `beforeAll` but `loginAsTestUser` ran in each `beforeEach`, exhausting the limit without resetting it. |
| **Fix** | Renamed header's inline mobile nav to `aria-label="Mobile page links"` (`nav.mobilePageLinks` i18n key, both en/ro). Moved dashboard E2E seed from `beforeAll` to `beforeEach` so `resetRateLimits()` runs before each login. Updated unit test assertions. Commit: `46a0d0a`. |
| **Verification** | Run [#22487468377](https://github.com/dobrician/ideate/actions/runs/22487468377) — all 7 jobs green (Unit Tests, Lint, Type Check, Build, E2E Tests, Smoke Tests, Docker Push). |
| **Preventive rule** | When adding new navigation landmarks, always use unique `aria-label` values to avoid Playwright strict mode violations. When E2E tests share a single seeded user across multiple logins, ensure rate limiters are reset between tests (call seed endpoint in `beforeEach`, not `beforeAll`). |

---

### CI Incident Audit — 2026-02-27

| Field | Detail |
|-------|--------|
| **Run** | [#22483148488](https://github.com/dobrician/ideate/actions/runs/22483148488) |
| **Failed job** | Cloudflare Pages Deploy |
| **Root cause** | `@cloudflare/next-on-pages` requires `export const runtime = 'edge'` on all dynamic routes. This app uses `better-sqlite3`, `ioredis`, `pg` — Node-only APIs incompatible with Cloudflare's edge runtime. The job was masked with `continue-on-error: true` since Sprint 41 but always failed, producing a red annotation on every CI run. |
| **Fix** | Removed `cloudflare-deploy` job from `.github/workflows/ci.yml`. The app deploys via Docker (`docker-push` job). `wrangler.toml` retained for reference. Commit: `7ff9dda`. |
| **Verification** | Run [#22483503284](https://github.com/dobrician/ideate/actions/runs/22483503284) — all 7 jobs green, zero `continue-on-error` workarounds. |
| **Preventive rule** | Never add a CI deploy job targeting an incompatible runtime (edge vs Node). If the app uses Node-only packages (`better-sqlite3`, `pg`, native addons), only deploy to Node-compatible targets (Docker, VPS, Railway, Fly.io). Cloudflare Pages/Workers require edge-compatible code. |

---

### ✅ [Sprint 69 — Analytics Export, Embedding Quality, CI Comparison, E2E Hardening & Notification Preferences](Sprint-69) *(2026-02-27)*
**Focus:** Workspace analytics CSV export, embedding similarity quality scoring, CI build branch comparison, E2E test hardening (retry/parallel/rate-limit), admin notification preferences
**Stats:** 5/5 goals | 2789 tests (+34) + 183 E2E (hardened) | Audit: low risk

---

### ✅ [Sprint 68 — Search Analytics Dashboard, Embedding Model Upgrades, CI Alerting, E2E & Performance Profiling](Sprint-68) *(2026-02-27)*
**Focus:** Search feedback analytics dashboard, embedding model migration path, CI build alerting with notifications, E2E expansion (search/embedding/mobile), performance profiling and bundle tracking
**Stats:** 5/5 goals | 2755 tests (+40) + 183 E2E (+18) | Audit: low risk

---

### ✅ [Sprint 67 — Search Quality, Embedding Freshness, CI Retention, E2E Flows & WCAG AAA 100%](Sprint-67) *(2026-02-27)*
**Focus:** Hybrid search RRF tuning with quality feedback, embedding freshness tracking with auto-regeneration, CI build retention cron, E2E expansion (project/voting/admin), WCAG AAA 100%
**Stats:** 5/5 goals | 2715 tests (+45) + 165 E2E (+20) | Audit: low risk, WCAG AAA 100%

---

### ✅ [Sprint 66 — Search UX, Embedding Config, CI Trends, E2E Expansion & WCAG AAA 95%](Sprint-66) *(2026-02-27)*
**Focus:** Semantic search UI polish (scores, response time, method labels), embedding admin config page, CI build timing trends with trend detection, E2E test expansion (search/admin/projects), WCAG AAA 95% (forced-colors, focus indicators, ARIA progressbar)
**Stats:** 5/5 goals | 2670 tests (+31) + 30 E2E (+14) | Audit: low risk, 95% WCAG AAA

---

### ✅ [Sprint 65 — Observability & Search: CI Metrics, Query Profiling, WCAG AAA, Embeddings & E2E](Sprint-65) *(2026-02-27)*
**Focus:** CI build metrics + artifact fix, query profiling expansion (16 queries), WCAG AAA high contrast + aria-keyshortcuts, semantic search embedding wiring, admin + search E2E tests
**Stats:** 5/5 goals | 2639 tests (+30) + 16 E2E | Audit: low risk, 90% WCAG AAA

---

### ✅ [Sprint 64 — Infrastructure & Quality: DB Indexes, CVE Fixes, WCAG AAA, CI & Bundle Optimization](Sprint-64) *(2026-02-27)*
**Focus:** 7 FK indexes, 5 CVE fixes, WCAG AAA (aria-busy, motion-reduce), CI artifact sharing + Playwright cache, bundle optimization
**Stats:** 5/5 goals | 2609 tests (+68) | Audit: low risk, 85% WCAG AAA

---

### ✅ [Sprint 63 — Final Polish & Documentation: Production Excellence](Sprint-63) *(2026-02-27)*
**Focus:** Performance fixes, security hardening, integration testing, production docs, production readiness
**Stats:** 5/5 goals | 2541 tests (+121) | Audit: low risk, production ready

---

### ✅ [Sprint 62 — Mobile & Accessibility: Advanced Mobile Features & Universal Access](Sprint-62) *(2026-02-27)*
**Focus:** Offline-first PWA, push notifications, mobile-optimized UI, WCAG 2.1 AAA, PWA excellence
**Stats:** 5/5 goals | 2420 tests | Audit: 6 security fixes, 3 a11y fixes applied

---

### ✅ [Sprint 61 — Integration & API Excellence: Webhook Enhancement & External Integrations](Sprint-61) *(2026-02-27)*
**Focus:** Enhanced webhooks (12 events, retry strategies, payload templates), Slack/Teams/Discord integrations, API key management (tiered rate limits), integration dashboard
**Stats:** 5/5 goals | 2328 tests

---

### ✅ [Sprint 60 — Performance & Scale: Advanced Caching & Optimization](Sprint-60) *(2026-02-27)*
**Focus:** Multi-layer caching, CDN integration, DB query optimization, frontend performance, monitoring suite
**Stats:** 5/5 goals | 2254 tests

---

### ✅ [Sprint 59 — Search & Discovery: Advanced Features & Integration](Sprint-59) *(2026-02-27)*
**Focus:** Advanced filters, federated cross-entity search, search analytics, smart suggestions, search API
**Stats:** 5/5 goals | 2116 tests

---

### ✅ [Sprint 58 — AI Lifecycle Management: Advanced AI Features & Learning Systems](Sprint-58) *(2026-02-27)*
**Focus:** AI feedback learning, automated insights, smart notifications, model management, CI build recovery
**Stats:** 5/5 goals | 1963 tests

---

### ✅ [Sprint 57 — Real-time Collaboration: Live Editing & Advanced Presence](Sprint-57) *(2026-02-27)*
**Focus:** Operational transforms, collaborative editor, advanced presence, document sync, collaboration UX
**Stats:** 5/5 goals | 1963 tests

---

### ✅ [Sprint 56 — Advanced Permissions: Time-based & Dynamic Permission Controls](Sprint-56) *(2026-02-27)*
**Focus:** Time-based rules, dynamic permission evaluation, fine-grained ACLs, permission monitoring, testing tools
**Stats:** 5/5 goals | 1917 tests

---

### ✅ [Sprint 55 — Advanced Permissions & Workflow Engine: Custom Stages & Approval Chains](Sprint-55) *(2026-02-27)*
**Focus:** Configurable workflow stages, custom stage management, approval chains, conditional permissions
**Stats:** 5/5 goals | 1871 tests

---

### ✅ [Sprint 54 — Advanced Analytics & Insights: Vote Velocity & Social Network Analysis](Sprint-54) *(2026-02-27)*
**Focus:** Vote velocity tracking, social network analysis, momentum scoring, predictive success scoring
**Stats:** 5/5 goals | 1837 tests

---

### ✅ [Sprint 53 — AI Lifecycle Management: Smart Routing & Conflict Detection](Sprint-53) *(2026-02-26)*
**Focus:** Smart proposal routing, conflict detection, predictive deadlines, auto-generated roadmaps, AI dashboard
**Stats:** 5/5 goals | 1797 tests

---

### 📋 [Sprint 52 — Advanced Search & Discovery: Semantic Search with Embeddings](Sprint-Plan-Advanced) *(planned)*
**Focus:** Vector embeddings, semantic search, content recommendations, trend detection, discovery UI

---

### ✅ [Sprint 51 — Real-time Collaboration Foundation: Live Presence & WebSocket](Sprint-51) *(2026-02-19)*
**Focus:** WebSocket server, user presence, typing indicators, project-level live updates, connection management
**Stats:** 5/5 goals complete

---

### ✅ [Sprint 50 — Horizontal Scaling: Redis Infrastructure & Database Flexibility](Sprint-50) *(2026-02-19)*
**Focus:** Redis pub/sub, PostgreSQL adapter, cache L2 with Redis, graceful fallback
**Stats:** 5/5 goals

---

### ✅ [Sprint 49 — Performance & Scale Hardening: Background Jobs & Query Optimization](Sprint-49) *(2026-02-19)*
**Focus:** Background job queue, query optimization with indexes, caching infrastructure, performance monitoring, resource limits
**Stats:** 5/5 goals

---

### ✅ [Sprint 48 — Realistic Data Factories & High-Volume Simulation](Sprint-48) *(2026-02-19)*
**Focus:** Factory system for 20+ realistic users, projects, proposals, votes, threaded comments. CLI seeder + admin API endpoint.
**Stats:** 13/13 goals | 1423 tests

---

### ✅ [Sprint 47 — Security, DX & Quality](Sprint-47) *(2026-02-18)*
**Focus:** Fix search XSS, action/API wrappers, analytics N+1, i18n errors, test fix, onboarding, proposal tags UI, a11y polish
**Stats:** 8/8 goals | 1391 tests

---

### ✅ [Sprint 46 — Enterprise Features: Teams, Custom Roles & Analytics](Sprint-46) *(2026-02-18)*
**Focus:** Multi-tenant teams/organizations, configurable roles (dynamic RBAC), advanced analytics dashboard
**Stats:** 3/3 goals | 1373 tests

---

### ✅ [Sprint 45 — 100% Coverage Ceiling & Test Fix](Sprint-45) *(2026-02-18)*
**Focus:** Fix broken proposal-list bar chart test, close all remaining branch coverage gaps (proxy, email-deliverability, search route, profile actions, proposal actions, db/index)
**Stats:** 8/8 goals | 1269 tests | Branch coverage 99.18% → 100% across all metrics

---

### ✅ [Sprint 44 — Branch Coverage Ceiling & File Size Compliance](Sprint-44) *(2026-02-18)*
**Focus:** Close all remaining branch gaps (webhooks, llm-cache, llm, mail, comment-utils, search, auth, oidc, password), resolve export.ts barrel false positive, split oversized openapi-spec.ts
**Stats:** 8/8 goals | 1262 tests | Branch coverage 97.35% → 99.18%

---

### ✅ [Sprint 43 — Export Coverage, Sentry, E2E CI, Proxy Migration & Dead Code](Sprint-43) *(2026-02-18)*
**Focus:** Add export.ts tests, close rate-limit/digest branch gaps, integrate Sentry, add E2E to CI, complete proxy migration, remove unused exports
**Stats:** 8/8 goals | 1251 tests | Closed #13, export/rate-limit/digest at 100% branch

---

### ✅ [Sprint 42 — Coverage Gaps: request-utils, search, rate-limit, digest, notifications, llm, sanitize, auth](Sprint-42) *(2026-02-18)*
**Focus:** Close remaining branch/statement coverage gaps across 8 library modules
**Stats:** 8/8 goals | 1244 tests | Branch coverage 91.87% → 96.66%

---

### ✅ [Sprint 41 — Cloudflare, Coverage, Accessibility & SSO](Sprint-41) *(2026-02-18)*
**Focus:** Cloudflare deployment, close coverage gaps (digest/utils/mail), search keyboard a11y, change-password, OIDC SSO, webhook resilience
**Stats:** 8/8 goals | 1223 tests | Cloudflare Pages + D1, OIDC SSO, keyboard a11y

---

### ✅ [Sprint 40 — Rate Limiting, Data Retention & Admin Dashboard](Sprint-40) *(2026-02-18)*
**Focus:** PDF locale fix, PWA iOS safe-area, rate limiting on all server actions, admin rate-limit dashboard, audit log data retention, proxy tests, projects coverage
**Stats:** 8/8 goals | 1195 tests | Rate limiting, data retention cron, admin dashboard

---

### ✅ [Sprint 39 — UX Polish, Security Hardening & DevOps](Sprint-39) *(2026-02-18)*
**Focus:** PWA mobile overlap, AI model disclosure, dialog focus fix, trusted proxy validation, Docker CI push, DB backup automation, email change flow, API rate limiting
**Stats:** 8/8 goals | 1115 tests | Email change flow, rate limiting on all API routes

---

### ✅ [Sprint 38 — Code Quality, Dead Code Removal & Accessibility Polish](Sprint-38) *(2026-02-17)*
**Focus:** Inline lone query, locale fallback fix, role=alert on error containers, rename buildCommentTree, remove re-export shim, dead sanitize exports, locale export test, dead code audit
**Stats:** 8/8 goals | 1099 tests | All dead code items from deep analysis resolved

---

### ✅ [Sprint 37 — Search, Webhooks & Developer Experience](Sprint-37) *(2026-02-17)*
**Focus:** Full-text search (FTS5+Cmd+K), webhooks, comment threading UI, LLM caching, API docs, email digests, project templates, GDPR export
**Stats:** 8 commits | 900+ tests | 8 features: FTS5 search, webhooks, threading, LLM cache, Swagger docs, digests, templates, GDPR export

---

### ✅ [Sprint 36 — Enterprise Features & Polish](Sprint-36) *(2026-02-17)*
**Focus:** File attachments, project archival (read-only), bulk operations, notification preferences, advanced sorting, categories/tags, markdown proposals, dashboard charts
**Stats:** 8 commits | 869+ tests | 8 new features | recharts + react-markdown integrated

---

### ✅ [Sprint 35 — Production Hardening & DevOps](Sprint-35) *(2026-02-17)*
**Focus:** Sentry error tracking, E2E in CI, flaky test fix, SSE heartbeat, DB backup, user invitations, audit export, middleware→proxy migration
**Stats:** 8 commits | 869 tests | Sentry integrated | E2E in CI | Invitations + audit export features

---

### ✅ [Sprint 34 — UI Consistency Audit & Fix](Sprint-34) *(2026-02-17)*
**Focus:** Button standardization, remove className hacks, enforce 44px touch targets, consistent variants across all pages
**Stats:** 8 commits | 869 tests | UI conventions documented | Zero manual size overrides remaining

---

### ✅ [Sprint 33 — Visual Review v2 Remaining Fixes](Sprint-33) *(2026-02-17)*
**Focus:** Duplicate form/discussion removal, admin mobile cards, navbar consolidation, dashboard mobile, auth/form polish, 404 auth redirect
**Stats:** 6 commits | 869 tests | All v2 review issues resolved

---

### ✅ [Sprint 32 — Visual Review P1+P2 Fixes](Sprint-32) *(2026-02-17)*
**Focus:** Dark mode button contrast, duplicate proposal form, profile tabs, admin mobile table, navbar tap targets, form consistency, branding, truncation, audit log readability, P3 quick wins
**Stats:** 8 commits | 869 tests | 20+ visual issues fixed | Source: automated visual review (56 screenshots)

---

### ✅ [Sprint 31 — Design Polish & Layout Improvements](Sprint-31) *(2026-02-17)*
**Focus:** Project detail layout restructure, proposal button truncation, author name wrapping, vote bar tooltip, locale dates, expand UX, equal-vote sorting, mobile spacing
**Stats:** 8 commits | Source: manual mobile testing by Ciprian

---

### ✅ [Sprint 30 — Security & Accessibility Hardening](Sprint-30) *(2026-02-17)*
**Focus:** Open redirect fix, Zod on AI endpoints, HSTS, middleware bypass fix, a11y critical (skip-link, headings, aria), code dedup, DB indexes/schema, change password in profile
**Stats:** 862 tests | 8 security+a11y fixes | Source: deep analysis report

---

### ✅ [Sprint 29 — UI/UX Polish (ChatGPT Review Fixes)](Sprint-29) *(2026-02-17)*
**Focus:** Proposal submit feedback, real PDF export, styled form validation, auth error messages, admin UX (toast+search+pagination), i18n consistency, mobile/responsive fixes, projects list search/sort/filter
**Stats:** 8 commits | 795 tests | Source: external ChatGPT UI/UX review (score 6/10 → fixes applied)

---

### ✅ [Sprint 28 — Mobile Polish & Final Sweep](Sprint-28) *(2026-02-17)*
**Focus:** Admin table mobile fix, iOS select auto-zoom prevention, header/nav 44px touch targets, action button touch targets, form/dialog button touch targets, auth page touch targets, markdown overflow protection, mobile nav overflow resilience, Playwright mobile device projects (Pixel 5 + iPhone 13), mobile E2E test suite
**Stats:** 10 commits | 792 tests | Issue #49

---

### ✅ [Sprint 27 — Voting & Proposals](Sprint-27) *(2026-02-17)*
**Focus:** Vote integrity (server-side projectId resolution), submit-suggested deadline+SSE+notifications, SSE keepalive leak fix + exponential backoff, accessibility (aria-labels, aria-pressed), optimistic vote UI, center-anchored vote bar, proposal card animations, mobile 44px touch targets, useVoteStream unit + SSE E2E tests, dead code cleanup + shared emitVoteUpdate helper
**Stats:** 10 commits | 792 tests | Issue #48

---

### ✅ [Sprint 26 — Comments & Discussion](Sprint-26) *(2026-02-17)*
**Focus:** Avatar bubbles, hover timestamps, character count, smart polling, comments in export, discussion UX polish, mobile keyboard hardening, component + scroll tests, parentId validation
**Stats:** 10 commits | 774 tests | Issue #47

---

### ✅ [Sprint 25 — AI Features](Sprint-25) *(2026-02-16)*
**Focus:** Structured LLM logging, graceful AI degradation, suggestion retry logic, dashboard query coverage, E2E AI tests, mobile AI dialogs, logo integration
**Stats:** 7 commits | 718 tests | Issue #46, #40

---

### ✅ [Sprint 24 — Project Detail Page](Sprint-24) *(2026-02-16)*
**Focus:** Markdown rendering (descriptions, proposals, comments), edit project dialog, two-column layout with sticky sidebar, deadline enforcement, mobile comment height, project CRUD unit tests, E2E tests
**Stats:** 12 commits | 702 tests | Issue #45

---

### ✅ [Sprint 23 — Dashboard Redesign](Sprint-23) *(2026-02-16)*
**Focus:** Null-safe activity links, user-scoped activity feed, personal stats, Quick Actions bar, deadline badges, project stats cards, compact mobile pills, mobile search toggle, dashboard E2E + unit tests
**Stats:** 12 commits | 670 unit tests | Issue #44

---

### ✅ [Sprint 22 — Auth & Security Deep Dive](Sprint-22) *(2026-02-16)*
**Focus:** CSRF enforcement, JWT middleware validation, Zod error fix, rate limiting, token hashing (SHA-256), audit logging, verify-email UX, password visibility toggle, proposal form modal, E2E auth tests
**Stats:** 13 commits | 649 unit + 52 E2E = 701 tests | Issues #41, #42, #43

---

### ✅ [Sprint 21 — Migration Reliability & AI Feature Testing](Sprint-21) *(2026-02-16)*
**Focus:** Idempotent migrations (IF NOT EXISTS), Docker build race condition fix, retry logic, E2E test scaffolding
**Stats:** 2 commits | Migrations fixed | Docker builds reliable | E2E test files created (AI suggestions, comments, voting)

---

### ✅ [Sprint 20 — Coverage Gaps, Dead Code & Hardening](Sprint-20) *(2026-02-16)*
**Focus:** New logo (#40), csrf-client/proposals/auth/notifications coverage gaps closed
**Stats:** 5/8 goals | 616 tests | Logo updated with ballot-box icon

---

### ✅ [Sprint 19 — AI Features from Ideator](Sprint-19) *(2026-02-16)*
**Focus:** Port all AI features from ideator: project summaries, AI proposal suggestions, similarity check, markdown renderer
**Stats:** 10 commits | 32/32 smoke | 30 new tests

---

### ✅ [Sprint 18 — UI Polish & Chat Redesign](Sprint-18) *(2026-02-16)*
**Focus:** Vote bar polish, messenger-style chat redesign, test coverage gaps
**Stats:** 8 commits | 32/32 smoke | Issues #37-39

---

### ✅ [Sprint 17 — Vote Bar Redesign & Polish](Sprint-17) *(2026-02-16)*
**Focus:** Vote bar chart redesign (green left/red right, proportional), comment UI polish, migration runner fix
**Stats:** 7 commits | 32/32 smoke | Issues #32-34, #36

---

### ✅ [Sprint 16 — Project Comments & Quality](Sprint-16) *(2026-02-16)*
**Focus:** Project-level comments (#19), ProposalList/VoteButtons tests, dead code cleanup, SQLite backup automation, CSRF E2E test
**Stats:** 8/8 goals | 556 tests | Issue #19

---

### ✅ [Sprint 15 — Security, UX Fixes & Nav Polish](Sprint-15) *(2026-02-16)*
**Focus:** CSRF wiring, registration validation, admin nav, magic link UX, shadcn dropdown, structured logging, project comments spike
**Stats:** 12 commits | 579 tests | 32/32 smoke | Issues #19, #28-31

---

### ✅ [Sprint 14 — UI Overhaul & Bug Fixes](Sprint-14) *(2026-02-16)*
**Focus:** Remove sidebar, top nav bar, homepage=dashboard, dark mode toggle, proposal bar chart, logout/PWA/i18n bug fixes
**Stats:** 10 commits | 562 tests | 32/32 smoke | Issues #16-27

---

### ✅ [Sprint 13 — Security Hardening & Scalability](Sprint-13) *(2026-02-16)*
**Focus:** CSRF fix, HTML sanitization in emails, vote validation, CSP hardening, DB indexes, pagination, PostgreSQL spike
**Stats:** 10 commits | 562 tests | 32/32 smoke

---

### ✅ [Sprint 12 — Polish & Deferred Fixes](Sprint-12) *(2026-02-16)*
**Focus:** Dark mode WCAG AA contrast, tooltips, profile translations, version bump
**Stats:** v1.1.0 released | 541 tests | 32/32 smoke

---

### ✅ [Sprint 11 — Critical UX Fixes from UI Review](Sprint-11) *(2026-02-16)*
**Focus:** Logout fix, auth pages minimal layout, locale persistence, translations, 403 page, PWA popup, voting UX, delete modals, search, date format
**Stats:** 10/12 goals | 20 commits | 32/32 smoke | Based on ChatGPT Operator review

---

### ✅ [Sprint 10 — UI/UX Polish & Romanian Translation](Sprint-10) *(2026-02-16)*
**Focus:** Complete RO translations (150+ keys), locale switcher, date/number localization, visual hierarchy, dark mode, mobile responsive, auth pages polish
**Stats:** 16 commits | 541 tests | 32/32 smoke | First sprint with incremental commits + wiki auto-sync

---

### ✅ [Sprint 9 — Email/Password Authentication](Sprint-09) *(2026-02-16)*
**Focus:** Dual auth (magic link + password), registration, email verification, password recovery, rate limiting, mail log for testing
**Stats:** 21 commits | 541 tests | 32/32 smoke | +62 new tests

---

### ✅ [Sprint 8 — Integration Testing & Stability](Sprint-08) *(2026-02-16)*
**Focus:** Smoke test expansion, error recovery testing, API route security, file splitting, v1.0.0-rc1
**Stats:** 479 tests | 97.55% coverage | 20 smoke tests

---

### ✅ [Sprint 7 — Quality, Testing & Refinement](Sprint-07) *(2026-02-16)*
**Focus:** Coverage audit (82%→96%), WCAG 2.1 AA accessibility, DB indexes (15), code cleanup, visual polish
**Stats:** 453 tests | 96.35% coverage | +63 new tests

---

### ✅ [Sprint 6 — PWA, Export & Quality](Sprint-06) *(2026-02-16)*
**Focus:** PDF/CSV export, PWA support, E2E tests, security hardening, email notifications, deadlines, admin panel, SEO
**Stats:** 390 tests | 8 features | Issues #7, #12

---

### 🔄 [Sprint 48 — Realistic Data Factories & High-Volume Simulation](Sprint-48) *(2026-02-19)*
**Focus:** Factory system for generating realistic demo data — 20 users, multiple projects, proposals with real-feeling content, diverse voting patterns, threaded comments
**Stats:** In progress

---

### ✅ [Sprint 5 — CI/CD & Infrastructure](Sprint-05) *(2026-02-16)*
**Focus:** GitHub Actions CI, FTS5 search, audit logging, Docker backup, email deliverability, i18n EN/RO, OpenAPI docs, performance
**Stats:** 260+ tests | Issues #2, #3, #9, #10, #11

---

### ✅ [Sprint 4 — Polish & Enterprise Features](Sprint-04) *(2026-02-16)*
**Focus:** RBAC (4 roles, 13 permissions), SSE real-time voting, AI rate limiting, dashboard, pagination, toast notifications, mobile polish
**Stats:** 260 tests | Issues #4, #6, #8

---

### ✅ Sprint 3 — Proposals & Voting *(2026-02-15)*
**Focus:** Proposals CRUD, voting system (+1/-1), vote bar charts, threaded comments, AI summarization (Gemini/OpenAI), auth middleware, profile page
**Stats:** 6 commits | Issues #1, #4

---

### ✅ Sprint 2 — Auth & Core Features *(2026-02-15)*
**Focus:** Email magic link auth, JWT sessions with CSRF + rotation, projects CRUD, smoke test suite
**Stats:** 7 commits | 20 tests | 8 smoke tests | Issue #5

---

### ✅ Sprint 1 — Foundation *(2026-02-15)*
**Focus:** Next.js 16, TypeScript strict, Drizzle ORM + SQLite, Docker, shadcn/ui, basic layout
**Stats:** 9 commits | 1 test | 2 smoke tests
