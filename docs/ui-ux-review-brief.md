# UI/UX Review Brief — Ideate Platform

## Mission
You are a **senior UI/UX designer and frontend engineer** reviewing a production web application called **Ideate** — a democratic idea prioritization platform for teams. This app will be used by real users in real companies. Your job is to identify every UI/UX problem and produce a detailed, actionable report.

## Access
- **Staging URL**: https://idea.surmont.co/
- **Test User 1**: tibi@surcod.ro (request magic link, check email)
- **Test User 2**: reviewer@surcod.ro (request magic link, check email)
- Both emails forward to ciprian.dobrea@gmail.com (Cloudflare catch-all)
- To read emails: `source /home/dc/.config/gogcli/gog.env && gog gmail search "from:idea@surcod.ro newer_than:5m" --max 3`
- Then: `gog gmail read <thread-id>` to get the magic link

## What to Review (in this order)

### 1. Design System Audit
- Color palette: consistency, contrast ratios (WCAG AA minimum)
- Typography: font sizes, weights, line heights — readable? hierarchical?
- Spacing: consistent padding/margins? Does it follow a scale (4px/8px)?
- Component consistency: do buttons, cards, inputs look the same everywhere?
- Dark mode: does it actually work? Are there contrast issues? Invisible text?
- Light mode: same checks

### 2. Layout Architecture
- Is the sidebar/header/content structure logical?
- Does the layout breathe? Or is it cramped/too sparse?
- Is there wasted space? (e.g., huge empty areas next to small forms)
- Is the visual hierarchy clear? (What should the user see first?)
- Does navigation make sense? Can a new user figure out where things are?

### 3. Page-by-Page Review
For EACH page, check in both EN and RO, in both dark and light mode, on both desktop (1920x1080) and mobile (375x812):

**Pages to visit:**
- `/` — Homepage (logged out)
- `/auth/login` — Login page
- `/dashboard` — User dashboard
- `/projects` — Projects list
- `/projects/new` — Create project
- `/projects/[id]` — Project detail (create a test project first)
- `/projects/[id]/edit` — Edit project
- `/profile` — User profile
- `/admin` — Admin panel

**For each page, report:**
- Layout issues (alignment, spacing, overflow, empty space)
- i18n issues (untranslated strings, mixed languages, date/number format)
- Responsive issues (mobile vs desktop)
- Dark mode issues (contrast, readability, missing dark variants)
- Interaction issues (hover states, focus states, loading states)
- Accessibility (keyboard navigation, screen reader, ARIA)
- Copy/microcopy quality (is text clear, helpful, professional?)

### 4. User Flow Review
Test these complete flows and note friction points:
- Sign up as new user → get magic link → verify → land on dashboard
- Create a project → add proposals → vote → see results
- Switch language EN ↔ RO mid-session
- Toggle dark/light mode
- Use on mobile (resize browser to 375px)
- Edit profile
- Search for a project/proposal

### 5. i18n Deep Audit
- Switch to RO locale
- Visit EVERY page
- List every string that is NOT translated
- Check date formats (should be DD.MM.YYYY or "16 februarie 2026" in RO)
- Check number formats
- Check that translated strings make sense (not just machine-translated gibberish)

### 6. Competitive Comparison
Compare the UI quality to these references:
- Linear.app (clean, fast, professional)
- Notion.so (flexible, polished)
- Slido.com (voting/polling UX)

Note where Ideate falls short of these standards.

## Output Format
Produce a structured report in Markdown:

```
# Ideate UI/UX Review Report

## Executive Summary
[2-3 sentences: overall impression, severity, key themes]

## Critical Issues (must fix before public launch)
1. [Issue] — [Page] — [Screenshot/description] — [Suggested fix]

## Major Issues (significantly impacts user experience)
1. ...

## Minor Issues (polish items)
1. ...

## i18n Report
### Untranslated strings by page
- /page: "string1", "string2", ...

## Design System Recommendations
[What needs to change at the system level]

## Page-Specific Recommendations
### /page-name
[Specific layout/design changes needed]
```

Save the report to: `/home/dc/work/ideate/docs/ui-ux-review-report.md`

## Important
- Be BRUTALLY honest. This is going public. Sugar-coating helps nobody.
- Take screenshots if possible (use Playwright's screenshot API)
- Think like a user who's never seen this app before
- Every finding must be actionable (not just "this looks bad" — say what to fix)
- Prioritize: what would embarrass us most if a potential customer saw it?
