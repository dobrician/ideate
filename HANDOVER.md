# Ideate — canonical handover

## Project code freeze and essential user experience preview

DC explicitly freezes the accepted project management screen and all interactions. Protect `/projects/[id]`, its edit route and `/p/[token]`, including proposal creation, AI duplicate review, voting, discussion, attachments, lifecycle, theme and mobile behavior. Shared navigation/CSS/auth/action/data changes must not alter these flows indirectly; reopen affected frozen scope only on DC's explicit instruction. The source review and proposed next-phase sequence are in `docs/design/User-Experience-Review.md` (#71, with #74 for SSO). Recommendations consolidate Projects as the sole home, retire redundant Dashboard/profile content lists, simplify account and SSO entry, then search and global prompts. DC subsequently authorized implementation in a separate public test version; it is now live there only. Production retains the accepted release and database. The original review remains the design baseline; current runtime and verification details are in the final section below.

## Current owner and runtime

The existing Ideate agent owns this project; SurCod coordinates capture read-only. Continue on `sprint/2026-10-03-decision-focused-project`, draft PR [#73](https://github.com/dobrician/ideate/pull/73). Public runtime: `https://ideate.surcod.ro`; legacy `idea.surmont.co` redirects permanently with path/query preserved; deployed application commit `878075b`, image `bda634076936`, healthy. Previous image `dc53ece7a0d8` remains available for rollback. Local development is on port 4101. Do not modify existing database files/backups in the worktree or run the global seed for a demo reset.

## SurCod family-holiday demonstration — ready

Public project: [Our next family holiday](https://ideate.surcod.ro/p/b4b59b23-f210-4e8b-a77a-823f1904befd).
Project ID: `5870f7bc-79fa-427d-bc85-a64803750f2b`.

Exactly two English proposals, no calendar years in project/proposal content:

1. **A week by the sea in Crete** — family beach holiday, swimming, a small seaside apartment.
2. **A mountain cabin getaway** — hiking and nature.

Existing actor: `ciprian.dobrea@gmail.com`. Fictional authors: Emma Parker and James Reed, with their notification preferences disabled. Initial state: Crete 2 Pro, cabin 1 Pro; actor has no vote on Crete or cabin. No comments. This is a separate project; the prior customer-experience demo remains intact.

Actual browser verification attempted **A family beach holiday in Crete**, detected a 95% semantic duplicate of the existing Crete proposal, cast +1 on the existing idea and closed with **Done — I voted**. No third proposal was created. Server/cache evidence proves one new Anthropic Haiku inference, 1559ms, 579 tokens, application estimate 0.002895 USD. DC explicitly authorized up to 0.05 USD on the existing API after the paid-provider limitation was reported; no service was activated. Do not replace this with a mock or claim OAuth was used.

Reset removed only the actor's Crete vote and this unique demo prompt's cache entry, preserving live-response evidence. Exactly two proposals and no actor vote were verified afterward in the database and browser. Unrelated-data hashes matched across preparation and reset. No application changes or deploy were needed; no emails, WhatsApp, DC notification or Tibi task registry were used.

## Private access and capture instructions

Do not commit, print or paste credentials. Authorized capture handoff files:

- `/home/dc/.local/state/surcod-demo/ideate-access.json` — mode 0600; authenticated portable storageState, public URL and expiry.
- `/home/dc/.local/state/surcod-demo/ideate-storage-state.json` — mode 0600; standalone browser state, English locale and light theme. `/api/me` validated access as the actor.
- `/home/dc/.local/state/surcod-demo/ideate-handoff.md` — non-secret exact text, UI locators, real AI proof and strict reset procedure.
- `/home/dc/.local/state/surcod-demo/ideate-evidence/` — preserved inference, vote/reset proofs and screenshots.
- `/home/dc/.local/state/surcod-demo/ideate-reset.cjs` — guarded owner reset helper, mode 0600; Drizzle only. It refuses unexpected proposal count or actor state and never deletes a project/proposal/user or unrelated vote/cache.

The shared browser tab is already at the reset project. Capture with a smooth cursor and no zoom; only AI waiting may be cut. Submit the exact candidate text from the handoff, vote **Pro** within the duplicate review, then **Done — I voted**. Leave optional global tags unselected. AI explanation/score can vary on a new inference; the prepared prompt's cache was cleared so capture gets a fresh real call. Keep additional paid usage within the authorized ceiling.

## Verification and continuity

The unchanged deployed source was verified with 2,864 unit tests, all 636 browser cases (one Safari fixed-delay SSE case passed unchanged in isolation, issue #83), TypeScript/ESLint/build, and 32 public smoke checks. This preparation additionally verifies actual live AI, authenticated UI voting, exactly two proposals, reset and unrelated-data preservation. No mocks or test selectors were changed for this task.

Temporary preparation scripts/log copies: `/tmp/codex-ideate-surcod-demo-20261003`, registered through 2026-10-05; permanent requested handoff and proof copies remain under the private state directory. The session expiry is in the access file. Regenerable preparation scripts are removed after delivery; the guarded reset helper is retained for capture.

## Final coordination check

A final guard observed a further live request for this demo and a new actor +1 after the initial reset (22:30 UTC); its caller was not established. Preserve the initial proofs separately and perform the same guarded reset again. The second request logs 1457ms, 547 tokens and an application estimate 0.002735 USD. Both observed requests total an estimated 0.005630 USD, below the authorized ceiling. Final DB verification again confirms exactly two proposals, no actor vote and no cached demo prompt. Capture must start only after the ready signal to avoid concurrent state changes.

## Manual theme control and palette review — 4 October

Restore a discoverable sun/moon control directly in the floating navigation (#84); language remains in the account menu. At widths below 360px use only the brand symbol to preserve Projects and three 44px controls. Real component tests cover system-dark override, keyboard switching and persistence; the browser assertion checks reload and both directions. The color analysis and schematic comparison are in `docs/design/Color-Review.md` and `docs/design/palette-review.html` (#85). Proposed colors are not applied. Do not change holiday-demo data or reset it for this UI task. Production commit `68a10c6` / image `dc53ece7a0d8` is healthy, with all 636 browser cases and 32 public smoke checks passing. Live theme switching/persistence and 320px geometry are verified. The color review was subsequently approved by DC; see the implementation verification below.

## Approved decision palette — deployed and verified

DC approved the forest/sage and clay palette (#85). Shared light/dark tokens now cover chart fills, selected Pro/Contra votes, the proposal drawer, duplicate review and own chat bubbles; primary actions follow their theme foreground. Neutral background/project surfaces integrate with this palette. Preserve error/deletion colors, chart geometry, preview/expand behavior and all production/demo data. Explicitly override the generic ghost button’s translucent dark hover for vote controls. Historical exact-color expectations and the chart test’s old emerald/rose selectors changed with the approved design requirement; new browser checks measure actual colors and contrast, preserving persisted drawer state.

Final candidate image `bda634076936` includes this hover correction and the existing OIDC build flag. All 2,869 unit tests pass (58.61s), TypeScript/ESLint/build are clean, and all three targeted palette browser cases pass (13.1s). Existing chat checks pass unchanged in all three browsers after clearing accumulated rate limits by restarting the isolated server. All 639 distinct browser cases are verified against this image using isolated SQLite and TLS: 632 pass in the full run (7.8m), all six chart/chat rechecks pass (10.5s), and three IP-limit checks pass separately (3.9s). Three chart failures were obsolete color selectors changed to match the approved palette; the Safari chat case hits accumulated shared test rate limits (#76) and passes unchanged after a server restart. Preserve these initial failure logs as well as passing rechecks. Production now runs `878075b` / `bda634076936`, healthy, with `dc53ece7a0d8` retained for rollback. All 32 live smoke checks pass (7.3s) with the configured mail-log path. Native browser probes confirm the actual light/dark chart, project and background colors, manual theme round trip and preference persistence after reload, with no overflow at 320px. Measured action contrast is 6.03:1 light / 7.17:1 dark; Pro 5.32 / 7.46, Contra 4.63 / 6.72, own chat 10.38 / 9.46. These measure the specified pairs, not whole-product conformance. Native screenshot capture fails in the current preview client; computed browser proof is preserved in `public-palette.json`. Existing projects, proposals and demo votes are unchanged; standard mandatory auth smoke uses synthetic registration accounts. Verification evidence is under `/tmp/codex-ideate-palette-20261004`, registered through 6 October.


## Domain migration and isolated essential UX test — 4 October

DC authorized a separate implementation preview at **https://test.ideate.surcod.ro**
and production at **https://ideate.surcod.ro**. The previous review-only phase is
superseded for the test branch, not production. Production retains image
`bda634076936` / application commit `878075b`, its existing SQLite volume and the
accepted project code freeze. Quadlet `ideate-staging.service` remains on :4100
with only APP_URL/OIDC_REDIRECT_URI overrides for the new production origin.
The legacy container name remains for continuity.

Test source is `/home/dc/work/ideate-test`, branch
`sprint/2026-10-04-essential-user-experience`, with `ideate-test.service` on :4104.
Its independent synthetic database is `/home/dc/.local/share/ideate-test/ideate.db`;
no production data was imported. Private environment is
`/home/dc/.config/ideate/test.env` (0600), distinct JWT secret and existing
Development OIDC client. Outbound SMTP and public E2E seed access are disabled.
The live standalone build must remain protected while systemd uses it.

Projects becomes the sole home in test; Dashboard redirects; account content
lists, technical search controls, project-creation options and intrusive
onboarding/install prompts leave ordinary user pages. Intentional fallback
login and role-restricted admin remain. No frozen project route, proposal
component, shared palette/CSS, mutation, auth backend, schema or AI code changes.
The detailed test-branch README and ops documentation describe build/rollback.
Do not promote this preview to production without DC's review.

The existing homelab agent owns DNS/NPM/TLS/redirect changes; it verified TLS
SANs, test noindex/no-store, exact OIDC callbacks and permanent 301 preservation.
The existing SurCod agent updated 5 maintained files / 11 hostname occurrences
in commit `3f53fe0`; production CTAs now link directly to the new domain, without
changing the Ideate video asset. No coordination messages used WhatsApp/email or the Tibi task registry.
The production auth smoke nevertheless sent two technical emails (magic link
and verification, 07:48 UTC) to its existing surcod.ro catch-all test addresses.
This breached DC's no-email constraint and was disclosed. Do not repeat outbound
auth smoke on production without explicit authorization; test SMTP is disabled.

Real local SSO authorize/PKCE/token exchange/Projects200/me200 verified on both
origins. Read-only Drizzle confirms SSO subject `393477611709858307` maps to
existing production Ciprian admin `e7b89463-9426-444d-abe6-7ededa897003` even though
its provider email differs. Test-only OAuth mapping was aligned to synthetic
Ciprian owner `d71bebde-4622-4e11-9166-72468a8b96aa`; the initial test account was
retained. A new real test login verifies that mapping. Owner `/api/me` checks
confirm Ciprian/admin on both origins. Google login remains unverified and
requires DC's fresh provider login; do not claim Google identity completion.
Private browser states remain in `ideate-oidc-local-state.json` (0600) under
`/home/dc/.local/state/surcod-demo`. Nonsecret proof files include
`ideate-oidc-local-proof.json`, `ideate-owner-session-proof.json`,
`ideate-identity-mapping.jsonl`, `ideate-freeze-proof.txt` and the final
`ideate-origins-live.md`. Production32 and final test32 smoke checks pass.
The existing PWA missing offline route (#72) remains open; static-asset smoke
now checks actual CSS/JS responses rather than unrelated global networkidle.

The synthetic test project is [Our next family holiday](https://test.ideate.surcod.ro/p/52009dd9-1a37-4b34-8c10-8fd5073c60db),
with exactly two English proposals and no initial owner vote. Production demos
and their capture/reset instructions are not reseeded or altered by this phase.
Verification/build logs are in `/tmp/codex-ideate-simplify-20261004`, registered
through 11 October. Protect the active test worktree/build through 3 November;
renew protection if review continues. Remove only owned regenerable inactive
builds/test processes, preserve evidence and unrelated data/backups.


Final preview verification: **2,869 unit tests / 213 files pass** (79.49s),
TypeScript/lint/build pass, and all **621 distinct E2E cases** are verified.
Full run: 614/615 pass (10.2m); the single mobile-Chrome navigation transport
failure passes unchanged after restarting the isolated server (3.4s). Three
IP-limit checks pass separately (7.6s, #76), plus three final public-origin
checks against the deployed metadata build (7.6s). Targeted165 UI cases also
pass. Final test32 smoke passes (15.6s); production32 passed (11.7s). Retain
initial failure evidence. Tests for retired Dashboard/profile tabs/search
controls changed only with approved requirements; direct replacement tests
cover account/redirect/search/SSO. No underlying frozen application defect was
hidden by changing its tests. Private live HTTP proof confirms healthy DBs,
PKCE S256/exact callbacks, test noindex/no-store and direct HTTP/HTTPS301
preserving encoded spaces and repeated query parameters.
