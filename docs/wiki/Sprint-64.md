# Sprint 64 — Infrastructure & Quality: DB Indexes, CVE Fixes, WCAG AAA, CI & Bundle Optimization

**Date:** 2026-02-27
**Status:** IN PROGRESS
**Focus:** Database index migration, dependency CVE fixes, WCAG AAA accessibility completion, CI pipeline optimization, bundle size reduction

## Goals

- [ ] **Goal 1: Database Index Migration** — Add indexes on 7 missing FK columns: teams.ownerId, webhookDeliveries.webhookId, proposalWorkflowState.currentStageId, permissionRules.createdBy, resourceAcls.grantedBy, aiInsights.dismissedBy, integrations.createdBy.

- [ ] **Goal 2: Dependency CVE Fixes** — Run `npm audit fix` to address 9 vulnerabilities (jsPDF, minimatch, rollup). Verify no breaking changes.

- [ ] **Goal 3: WCAG AAA Completion** — Add `aria-busy` to skeleton loaders, apply `prefers-reduced-motion` to Skeleton pulse animation, wire `prefersHighContrast()` in UI, ensure all dialogs have 44px close buttons.

- [ ] **Goal 4: CI Pipeline Optimization** — Share `.next/` build artifact between jobs (eliminate 2 redundant builds), cache Playwright browsers, gate docker-push on e2e-tests.

- [ ] **Goal 5: Bundle Optimization** — Expand `optimizePackageImports` for recharts/radix/sonner/zod, add dynamic imports for heavy admin routes.

## Results

*(updated after each goal)*

## Commits

| Hash | Description |
|------|-------------|
