# Ideate — canonical handover

## Current owner and runtime

The existing Ideate agent owns this project; SurCod coordinates capture read-only. Continue on `sprint/2026-10-03-decision-focused-project`, draft PR [#73](https://github.com/dobrician/ideate/pull/73). Public runtime: `https://idea.surmont.co`; deployed application commit `d628070`, image `2d9fd9122af0`, healthy. Previous image `45b4f3b50a8f` remains available for rollback. Local development is on port 4101. Do not modify existing database files/backups in the worktree or run the global seed for a demo reset.

## SurCod family-holiday demonstration — ready

Public project: [Our next family holiday](https://idea.surmont.co/p/b4b59b23-f210-4e8b-a77a-823f1904befd).
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

Restore a discoverable sun/moon control directly in the floating navigation (#84); language remains in the account menu. At widths below 360px use only the brand symbol to preserve Projects and three 44px controls. Real component tests cover system-dark override, keyboard switching and persistence; the browser assertion checks reload and both directions. The color analysis and schematic comparison are in `docs/design/Color-Review.md` and `docs/design/palette-review.html` (#85). Proposed colors are not applied. Do not change holiday-demo data or reset it for this UI task. Production deployment verification is pending.
