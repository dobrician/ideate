# User experience simplification review

Implementation status, 4 October: DC approved the separate essential UX preview at https://test.ideate.surcod.ro. Production remains frozen at https://ideate.surcod.ro. This review records the original proposal; current scope, verification and rollback are in `HANDOVER.md` and `ops/README.md`.

Status: reviewed from source on 4 October 2026; recommendations, not implemented.
Owner decision: DC has frozen the accepted project screen and all its interactions.
Backlog: [#71](https://github.com/dobrician/ideate/issues/71), SSO [#74](https://github.com/dobrician/ideate/issues/74).

## Product direction

Ideate helps a group understand a decision, compare proposals and express a vote.
AI should reduce reading and duplicate submissions. The interface should reveal
what needs deciding and the current support, rather than display the application's
feature inventory. Keep the accepted decision screen as the reference for density,
intentional disclosure, accessibility and visual hierarchy.

This review covers the ordinary user's routes, navigation, authentication,
account, search and global prompts. Administration is inventoried separately.
It is a static source review, not a telemetry study or a new authenticated usability
test. There is no evidence here that a feature has zero users.

## Code freeze: effective immediately

Freeze `/projects/[id]`, `/projects/[id]/edit` and `/p/[token]`, including the
proposal drawer, summaries, preview/expansion, chart backgrounds, voting,
duplicate detection, comments, attachments, project menus and lifecycle actions.
Preserve public read access, authentication before contribution and return to the
same project after login. Preserve theme switching, mobile layout and keyboard use.

Do not redesign or refactor these flows as part of the user-page simplification.
Shared navigation, theme/CSS, Markdown, auth, permissions, server actions and data
contracts are also dependencies of the frozen screen. A change outside its route
is not permission to change its behavior indirectly. Any proposed dependency
change must identify the effect and preserve the accepted screen; a change to
that screen requires DC to reopen the relevant scope explicitly.

No product source, database, demo state or deployment is changed by this review.

## Findings and proposed disposition

| Area | Current source evidence | Proposed user experience |
| --- | --- | --- |
| Projects | `/projects` is already the signed-in starting point. Local title search, pagination, status/tag/sort options; advanced filters already use disclosure. | Keep as the single home. Show understandable project summaries and one creation action. Keep archive/filter access intentional and preserve pagination. |
| Dashboard | `/dashboard` combines four personal counters, platform comparisons, quick actions, own projects/proposals, recent votes/activity, trending, recommendations and three charts. | Retire this destination from ordinary navigation. Merge useful project access into Projects; omit activity reporting and chart widgets from the default experience. Redirect old links only after auditing callers. |
| Account | `/profile` has Account, Security, Notifications, Projects and Proposals tabs. Its project/proposal lists duplicate other destinations; role, membership date and email repeat identity information. | One compact account/preferences page. Name, relevant identity management and notification choices. Remove duplicated content lists and routine metadata from the user UI. |
| Authentication | Login defaults to password; enabled SurCod SSO and magic link are separate secondary choices. Registration/recovery/verification have dedicated routes. | Make SurCod SSO the primary entry; disclose supported legacy alternatives intentionally. Preserve legacy handlers and existing accounts until migration is defined. |
| Search | `search-bar.tsx` exposes FTS, semantic and hybrid modes, entity filters, methods and scores. Projects also has its own title search. | One plain query and understandable results. Retrieval strategy belongs in the implementation; technical methods/scores belong in operator diagnostics. Define scope before combining local and global search. |
| Project creation | `/projects/new` requires title, description and deadline. Templates, status and categories already sit under More options; template retrieval uses an admin endpoint. | Start with the decision/question and context, retain the existing deadline contract, and review each advanced option against an actual user task. Do not add an onboarding wizard. |
| Onboarding | `OnboardingCheck` opens a three-step modal for signed-in users without `onboardingCompleted`; outside dismissal and the close control are disabled, though Skip is available. | Replace interruption with short contextual guidance or an empty-state explanation. This global component also touches the frozen project; implementation must preserve the project entry flow. |
| PWA prompts | Installation appears only after the browser offers it and if not dismissed; updates appear only when a new service worker is ready. | Installation can be an intentional account/menu action. Keep update availability discoverable without competing with the task; protect unsaved work before refresh. Preserve offline/error feedback. |
| Administration | `/admin/*` contains operations, AI, performance, analytics, workflows, permissions and integration tools. `/analytics` requires `user:manage`. | Keep operator functions in the admin area. Do not describe restricted analytics as an ordinary user page, or delete operational tools merely to reduce route count. |

Source anchors: `src/components/header.tsx`, `src/app/projects/page.tsx`,
`src/components/project-filters.tsx`, `src/app/dashboard/page.tsx`,
`src/app/profile/page.tsx`, `src/app/profile/profile-tabs.tsx`,
`src/app/auth/login/page.tsx`, `src/components/search-bar.tsx`,
`src/app/projects/new/page.tsx`, `src/components/onboarding-check.tsx`,
`src/components/onboarding-modal.tsx`, `src/components/pwa-install.tsx`,
`src/components/app-update.tsx`, `src/app/analytics/page.tsx`.

## Proposed information architecture

Primary destination: **Projects**. A project opens the existing frozen decision
screen. **Create project** is a page action, not a second portal. **Account** holds
preferences and identity; **Search** is a utility. **Admin** remains role restricted.
The floating navigation's accepted identity, theme control and project-return
behavior remain protected by the freeze.

Public link visitors read the existing project immediately. Contribution prompts
lead to SSO and return to that project, not a dashboard or onboarding tour.
Do not make the whole project directory public merely because shared links are
public: those are different access policies.

The useful distinction is current decisions versus archived decisions, not five
different views of personal activity. Avoid replacing the dashboard with another
collection of badges, recommendations or notifications on Projects.

## Decisions to resolve before implementation

1. **Project visibility and relevance.** The current Projects query is not filtered
   by ownership. Profile lists created projects, not group membership. Determine
   the intended directory/access policy before labeling anything “My projects”
   or introducing a personal queue. This observation alone does not establish an
   authorization defect.
2. **SSO identity ownership.** OIDC links live in `oauthAccounts`; `hasPassword`
   alone does not identify an SSO account. Determine the correct identity source
   and supported account-management URL before hiding local email/password forms.
3. **Deadline/lifecycle.** Creation currently requires a deadline. Making it
   optional would change contracts used by the frozen project, not just the form.
   Keep the current contract unless DC explicitly reopens that scope.
4. **Search cost and fallback.** Automatic semantic retrieval must respect existing
   provider configuration, availability and cost. A simpler UI does not authorize
   additional paid AI usage. Define a dependable text fallback.
5. **Feature dependencies.** Check route callers, notification producers, jobs,
   APIs and admin consumers before removing implementations or database fields.
   Hiding a user-facing feature is not evidence its backend can be deleted.

## Implementation order proposed for the next phase

1. Projects and account navigation: retire the redundant dashboard entry and
   profile content tabs; consolidate project access without changing permissions.
2. Login and preferences: prioritize SSO, compact account settings, retain
   intentional fallback access and test return-to-project behavior.
3. Search and prompts: hide retrieval mechanics and replace intrusive onboarding
   with contextual guidance, with explicit checks for the frozen entry flow.
4. Backend reduction: only after the new journeys are accepted and dependencies
   are mapped. Remove unused modules in small reversible changes, separately
   from presentation work and operational tooling.

Before code changes, record each selected scope and its acceptance criteria in
#71; use #74 for SSO-specific work. No new feature should be added just because
space has become available.

## Acceptance criteria

- One ordinary-user starting destination and no duplicate project/history tabs.
- Project discovery, creation, account settings and contribution login are clear
  on mobile as well as desktop, with keyboard and screen-reader access.
- Users do not need to choose a retrieval algorithm to search.
- SSO users can enter a shared project, authenticate and return to the same task;
  existing supported fallback accounts still work.
- No new interrupting onboarding step before a project's first contribution.
- Frozen project visuals, interactions, permissions and persisted data are
  unchanged; relevant regression checks cover shared dependency changes.
- No destructive migration, global seed or demo reset as part of simplification.

Measure task completion and navigation steps on these journeys before and after
implementation. Do not substitute reduced route count or fewer tests for a better
experience. This documentation-only review does not require a build/deployment
or repeating the already completed application regression suite.
