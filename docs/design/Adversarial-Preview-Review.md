# Adversarial review of the essential preview (#90)

DC requested a review/fix/re-review cycle using Claude Opus 5.5. Reviewers were read-only; the existing Ideate owner implemented and verified each accepted correction. Production, its data and infrastructure remain unchanged.

## Actual reviewer and cycle

All four calls used `claude-opus-5-5` through the existing Claude Code OAuth Max subscription. The response `modelUsage` metadata confirms that model for every substantive review. No new paid API/service was enabled and the application AI was not called. CLI metadata also includes its internal Haiku helper; it was not substituted for the requested reviewer.

| Round | Result | Owner response |
| --- | --- | --- |
| 1 | Eight findings, three priorities | Reproduce defects and implement seven findings within preview scope; defer very large counters |
| 2 | REQUEST_CHANGES | Reproduce native Escape clearing in Chromium/mobile Chrome; prevent default, reopen results with ArrowDown, remove option Tab stops, bound summary height and preserve guest query context |
| 3 | PASS for the reviewed core patch | Add unique per-case markers to long-summary fixtures, preventing stale renders from passing vacuously |
| 4 | PASS for isolated Projects pagination | Actual 320px browser overflow required a compact page window opted into by Projects only; frozen project-detail defaults remain unchanged |

These are source-review verdicts, separate from the owner's executable tests. Round 2 examined profile/notification recovery; round 3 explicitly did not re-review those source files.

## Accepted fixes

- Native submit button plus a persistent form makes keyboard logout dependable. Selection keeps the submitter mounted until navigation; application logout behavior is unchanged.
- Search discards stale options during query changes. Autocomplete semantics and active selection are attached to the focused input. Escape first closes results without clearing text; a second Escape closes the panel and restores focus. ArrowDown reopens results; options are not extra Tab stops.
- Guest sign-in computes the complete current path and query when selected, reusing the existing SSO entry. Loading account state and authentication routes do not offer misleading links.
- Project cards use simple Markdown, a three-line summary and a height bound for AI/fallback summaries, including lists, quotes and fences.
- Profile and notification requests recover from exceptions and release loading state. Controlled name fields retain the draft through React 19's automatic form reset.
- Cancel on direct project creation returns predictably to Projects.
- Closed mobile charts no longer inherit a desktop-preview fade or touch-sticky hover sliver. Expanded fades and desktop previews remain.
- Projects opts into at most three mobile page numbers, preserving 44px targets and query parameters. Shared pagination defaults in `/projects/[id]` and `/p/[token]` are untouched.

## Validation and limits

Final outcomes are recorded in HANDOVER and `/home/dc/.local/state/surcod-demo/ideate-opus-review-proof.md`. Preserve failed baseline and intermediate checks: these drove actual fixes, not weakened assertions. Existing search locators changed because the combobox role moved to the input; mobile mask expectations changed with the accepted presentation requirement. The new long-card fixture originally used a dynamic TS import incompatible with Playwright's loader; static imports fix the harness while retaining all height/overflow assertions.

All data-bearing browser checks use an explicitly enabled loopback server, owned SQLite and synthetic SSO-shaped sessions. Long-summary fixture writes use Drizzle and a guard refusing live/non-owned databases. Browser provider handoff is intercepted for context assertions; these checks do not claim a new live Google/SSO authentication verification. Native T3 browser checks are recorded separately; screenshot transport may be unavailable.

## Deferred scope (#91)

Very large counters can squeeze a mobile title; the rendering mechanism is known, but its practical threshold needs measurement and a representation decision. Frozen project-detail pagination/out-of-range recovery, long desktop proposal previews and cached header names remain follow-ups. Deadline policy is a contract question, not an established bug. Existing #72, #76, #83 and #88 remain outside this polish patch. No broad application rewrite or new feature was added.

## Runtime and evidence retention

Preview release uses `.next-opus-polish/standalone`; `.next-mobile-compact/standalone` remains rollback. Protect active/rollback builds through 3 November. Logs, raw reviewer responses and initial failure screenshots are under `/tmp/codex-ideate-opus-review-20261004`, registered through 11 October. Remove owned fixture processes/DBs/TLS/private fixture environment and the temporary Wiki checkout after publication. Preserve production DB/WAL/backups and unrelated processes.
