# Sprint 00 — UX Polish, Security Hardening & DevOps Automation

**Date:** 2026-02-18
**Focus:** PWA mobile overlap, AI model disclosure, dialog focus fix, trusted proxy validation, Docker CI push, DB backup automation, email change flow, API rate limiting

## Goals

- [x] **Goal 1: Fix PWA banner mobile overlap** — Move the PWA install banner from `fixed top-16` to bottom position on mobile to prevent content overlap. Desktop already uses `sm:bottom-4`.

- [ ] **Goal 2: Add AI model disclosure in suggestion dialog** — Surface the `modelUsed` field from `completeWithFallback` in the suggestion dialog so users know which AI model generated the suggestions.

- [ ] **Goal 3: Fix AI dialog focus management** — When the suggestion detail panel opens/closes, restore focus to the trigger element. Addresses deep analysis finding A.14 (nested dialog focus leakage).

- [ ] **Goal 4: Add trusted proxy validation for rate limiting** — `request-utils.ts` trusts `x-forwarded-for` without validation. Add `TRUSTED_PROXIES` env var support and fall back to direct IP when not behind a trusted proxy.

- [ ] **Goal 5: Add Docker image push to CI pipeline** — Add a `docker-push` job to `.github/workflows/ci.yml` that builds and pushes the Docker image to GitHub Container Registry on main branch pushes.

- [ ] **Goal 6: Add database backup automation to CI** — Add a scheduled GitHub Actions workflow that runs the existing backup script weekly.

- [ ] **Goal 7: Add email change flow to profile page** — Add an email change form with verification. User enters new email, receives verification link, email updates after confirmation.

- [ ] **Goal 8: Add rate limiting to remaining API routes** — Protect export, attachment, webhook, and template API routes with `checkRateLimit` calls.

## Notes

- After each goal, edit this file: change `- [ ]` to `- [x]` for that goal. Do NOT add new lines.
- Commit + push after EACH goal.
