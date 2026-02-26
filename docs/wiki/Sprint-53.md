# Sprint 53 — AI Lifecycle Management: Smart Routing & Conflict Detection

**Date:** 2026-02-26
**Status:** IN PROGRESS
**Focus:** AI-powered proposal routing, conflict detection, deadline optimization, auto-generated roadmaps, AI insights dashboard

## Goals

- [x] **Goal 1: Smart Proposal Routing** — `src/lib/ai/routing.ts` module using embeddings to suggest project assignments for proposals. Routing suggestions in proposal creation flow. Job handler for async routing.
- [x] **Goal 2: Conflict Detection Engine** — `src/lib/ai/conflicts.ts` to detect contradictory proposals using semantic analysis. Conflict warnings in UI with explanations. Periodic conflict detection via job queue.
- [ ] **Goal 3: Predictive Deadline Analysis** — `src/lib/ai/deadlines.ts` analyzing historical completion times to suggest realistic deadlines. Deadline suggestions in project creation and "deadline health" indicators.
- [ ] **Goal 4: Auto-generated Roadmaps** — `src/lib/ai/roadmap.ts` generating project roadmaps from approved proposals. Roadmap API at `/api/projects/[id]/roadmap`.
- [ ] **Goal 5: AI Insights Dashboard** — Admin dashboard at `/admin/ai-insights` showing routing accuracy, conflict detection rates, deadline prediction success, AI recommendation logs.

## Outcomes

*(updated as goals complete)*

## Notes
- All AI features have manual override options and graceful fallback when LLM unavailable
- Include confidence scores for all AI predictions
- Dependencies: Sprint 52 (embeddings), Sprint 49 (job queues)
