# Sprint 48 — Realistic Data Factories & High-Volume Simulation

**Date:** 2026-02-19
**Focus:** Build factory system to generate realistic, AI-quality sample data simulating 20+ users with diverse votes, proposals, and comments across multiple projects.

## Goals

- [ ] Create `src/lib/factories/` module with factories for: users, projects, proposals, votes, comments, tags
- [ ] Factory users: 20 realistic personas (Romanian + international names, real-looking emails, varied roles)
- [ ] Factory projects: 5-8 realistic project scenarios (product launches, office redesign, team retreats, budget allocation, tech stack migration, etc.)
- [ ] Factory proposals: 3-8 proposals per project, realistic content as if written by real people with different writing styles and perspectives
- [ ] Factory votes: Realistic voting patterns (not uniform — some proposals controversial, some unanimous, some polarizing)
- [ ] Factory comments: Threaded discussions with realistic back-and-forth, agreements, disagreements, questions, suggestions
- [ ] Factory tags: Realistic tag taxonomy (priority, category, department tags)
- [ ] Create `scripts/seed-demo.ts` — CLI script that runs all factories and populates DB with full demo dataset
- [ ] Create `src/app/api/admin/seed-demo/route.ts` — admin-only API endpoint to trigger seeding (with option to clean first)
- [ ] Add npm script: `npm run seed:demo` to run the CLI seeder
- [ ] All generated content should feel like it was written by real people in a real company — varied tone, different levels of detail, occasional typos or casual language
- [ ] Ensure factories are reusable and composable (can generate N users, M projects, etc.)
- [ ] Add tests for factories (they produce valid data, relationships are correct)
