# Sprint Log

Reverse chronological. Click each sprint for full details.

---

### 🔄 [Sprint 00 — Enterprise Features: Teams, Custom Roles & Analytics](Sprint-00) *(2026-02-18)*
**Focus:** Multi-tenant teams/organizations, configurable roles (dynamic RBAC), advanced analytics dashboard
**Stats:** 3/3 goals | 1373 tests

---

### ✅ [Sprint 03 — 100% Coverage Ceiling & Test Fix](Sprint-03) *(2026-02-18)*
**Focus:** Fix broken proposal-list bar chart test, close all remaining branch coverage gaps (proxy, email-deliverability, search route, profile actions, proposal actions, db/index)
**Stats:** 8/8 goals | 1269 tests | Branch coverage 99.18% → 100% across all metrics

---

### ✅ [Sprint 02 — Branch Coverage Ceiling & File Size Compliance](Sprint-02) *(2026-02-18)*
**Focus:** Close all remaining branch gaps (webhooks, llm-cache, llm, mail, comment-utils, search, auth, oidc, password), resolve export.ts barrel false positive, split oversized openapi-spec.ts
**Stats:** 8/8 goals | 1262 tests | Branch coverage 97.35% → 99.18%

---

### ✅ [Sprint 01 — Export Coverage, Sentry, E2E CI, Proxy Migration & Dead Code](Sprint-01) *(2026-02-18)*
**Focus:** Add export.ts tests, close rate-limit/digest branch gaps, integrate Sentry, add E2E to CI, complete proxy migration, remove unused exports
**Stats:** 8/8 goals | 1251 tests | Closed #13, export/rate-limit/digest at 100% branch

---

### ✅ [Sprint 00 — Coverage Gaps: request-utils, search, rate-limit, digest, notifications, llm, sanitize, auth](Sprint-00) *(2026-02-18)*
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

### ✅ [Sprint 40 — Security Hardening, Accessibility & Tech Debt](Sprint-40) *(2026-02-17)*
**Focus:** Account takeover fix, JWT revocation, auth logging, error text contrast, vote icon a11y, dialog focus, rate limiting, schema+hook cleanup
**Stats:** 8/8 goals | 1100 tests | Security hardened, a11y fixes, rate limiting on all API routes

---

### ✅ [Sprint 39 — Code Quality, Coverage Gaps & Accessibility](Sprint-39) *(2026-02-17)*
**Focus:** Fix lint warnings, close coverage gaps (search-d1/actions/db), split oversized files, remove dead code, localize export dates, proposal form a11y
**Stats:** 8/8 goals | 1096 tests | 6 files split, dead code removed, locale-aware exports, a11y fix

---

### ✅ [Sprint 30 — Docs Hygiene, Coverage Gaps & Production Hardening](Sprint-30) *(2026-02-17)*
**Focus:** Update stale docs (Known-Issues, Nice-to-Have), close coverage gaps (vote-update.ts, export.ts, llm.ts), Cloudflare deployment spike, push branch coverage past 93%
**Stats:** 8/8 goals | 808 tests | 93.85% branch coverage | 1 open issue (#13 Cloudflare — spike complete)

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
**Focus:** Port all AI features from ideator: project summaries, AI proposal suggestions (✨), similarity check, markdown renderer
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

### ✅ [Sprint 5 — CI/CD & Infrastructure](Sprint-05) *(2026-02-16)*
**Focus:** GitHub Actions CI, FTS5 search, audit logging, Docker backup, email deliverability, i18n EN/RO, OpenAPI docs, performance
**Stats:** 260+ tests | Issues #2, #3, #9, #10, #11

---

### ✅ [Sprint 4 — Polish & Enterprise Features](Sprint-04) *(2026-02-16)*
**Focus:** RBAC (4 roles, 13 permissions), SSE real-time voting, AI rate limiting, dashboard, pagination, toast notifications, mobile polish
**Stats:** 260 tests | Issues #4, #6, #8

---

### ✅ [Sprint 3 — Proposals & Voting](Sprint-03) *(2026-02-15)*
**Focus:** Proposals CRUD, voting system (+1/-1), vote bar charts, threaded comments, AI summarization (Gemini/OpenAI), auth middleware, profile page
**Stats:** 6 commits | Issues #1, #4

---

### ✅ [Sprint 2 — Auth & Core Features](Sprint-02) *(2026-02-15)*
**Focus:** Email magic link auth, JWT sessions with CSRF + rotation, projects CRUD, smoke test suite
**Stats:** 7 commits | 20 tests | 8 smoke tests | Issue #5

---

### ✅ [Sprint 1 — Foundation](Sprint-01) *(2026-02-15)*
**Focus:** Next.js 16, TypeScript strict, Drizzle ORM + SQLite, Docker, shadcn/ui, basic layout
**Stats:** 9 commits | 1 test | 2 smoke tests
