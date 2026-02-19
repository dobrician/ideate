import { randomUUID } from "crypto";

export interface DemoProposal {
  id: string;
  projectId: string;
  title: string;
  description: string;
  summary: string;
  userId: string;
}

interface ProposalTemplate {
  title: string;
  description: string;
  summary: string;
}

// Each key maps to a project title prefix for matching
const PROPOSAL_SETS: Record<string, ProposalTemplate[]> = {
  "Q2 Product Roadmap": [
    {
      title: "Prioritize Mobile App Redesign",
      description:
        "I think we should go all-in on the mobile app this quarter. Our mobile DAU is growing 12% month over month but the app still feels like a web wrapper. Key changes:\n\n- Native navigation patterns\n- Offline mode for core features\n- Push notifications overhaul\n\nI've talked to 5 enterprise customers and 4 of them said mobile is their #1 pain point right now.",
      summary: "Focus Q2 on native mobile experience improvements based on customer feedback.",
    },
    {
      title: "Launch API v2 First",
      description:
        "Respectfully disagree with the mobile-first approach. API v2 has been delayed twice already and our integration partners are getting frustrated. Two partners have explicitly told us they're evaluating competitors because our webhooks are unreliable and the rate limits are too aggressive.\n\nProposed timeline:\n- Weeks 1-3: Auth + core endpoints\n- Weeks 4-6: Webhooks v2 with retry logic\n- Weeks 7-8: Migration tooling for v1 users\n- Weeks 9-10: Beta with 3 key partners\n\nThis unblocks revenue that's currently stuck in the pipeline.",
      summary: "Prioritize API v2 to retain integration partners and unblock stalled revenue.",
    },
    {
      title: "Analytics Dashboard MVP",
      description:
        "We keep pushing the analytics dashboard to next quarter. Customers are literally building their own dashboards by exporting CSV files. That's embarrassing. Let me propose a middle ground: ship a basic dashboard with 5 key metrics (usage, retention, feature adoption, team activity, export trends) and iterate from there. We can reuse the Recharts setup we already have. I estimate 3-4 weeks of eng effort max.",
      summary: "Ship a minimal analytics dashboard now instead of deferring again.",
    },
    {
      title: "Technical Debt Sprint",
      description:
        "Before we commit to any new features can we PLEASE address the tech debt? Our test suite takes 14 minutes to run. We have 23 TODO comments in production code. The authentication module has 4 different patterns for error handling. If we spend 2 weeks cleaning this up, everything else will go faster for the rest of the year.\n\nI know this isn't the exciting pitch but it's the responsible one.",
      summary: "Dedicate 2 weeks to technical debt before starting new feature work.",
    },
    {
      title: "Combine Mobile + API Into One Initiative",
      description:
        "What if we don't choose? Hear me out. If we redesign the mobile app to use API v2 internally, we build both simultaneously. The mobile team becomes the first consumer of the new API. This forces us to make the API good because we eat our own dog food.\n\nRisks: higher coordination overhead, potential delays. But the outcome is stronger than doing either one alone. I'd suggest a joint squad of 2 mobile + 2 backend + 1 designer.",
      summary: "Build API v2 and mobile redesign together as a unified initiative.",
    },
  ],

  "Office Relocation": [
    {
      title: "Move to Pipera Business District",
      description:
        "I've been working with the facilities team on the Pipera option. Here's the full breakdown:\n\n**Location:** Floreasca Business Park, Building C, Floor 4\n**Space:** 680 sqm, open plan with 4 meeting rooms\n**Cost:** 14.50 EUR/sqm = ~9,860 EUR/month (vs 7,200 current)\n**Lease:** 5 years with break clause at year 3\n**Parking:** 25 spots included\n\nPros: Modern building, good metro access (Aurel Vlaicu), restaurants nearby, room to grow to 70 people.\nCons: 37% rent increase, some team members live in the south and would have a longer commute.\n\nI've attached the floor plan — it's a really nice space. We could have a dedicated quiet zone which people have been asking about.",
      summary: "Relocate to Floreasca Business Park in Pipera with room to grow to 70 people.",
    },
    {
      title: "Stay and Renovate Current Office",
      description:
        "I know the current office isn't perfect but hear me out — moving is incredibly disruptive. Last time we moved (2022) we lost almost 3 weeks of productivity and two people quit partly because of the new commute.\n\nThe landlord is open to a 3-year renewal at +5% (7,560 EUR/month). If we invest 35K in renovations we can:\n- Convert the unused storage room into a 6th meeting room\n- Add 8 more desks by reconfiguring the open area\n- Install proper soundproofing in the call booths\n- Upgrade the HVAC (it's been terrible in summer)\n\nTotal cost: 35K one-time + 7,560/month vs 9,860/month for Pipera. We save ~62K over 3 years.",
      summary: "Renew current lease and invest 35K in renovations to save 62K over 3 years.",
    },
    {
      title: "Go Fully Remote",
      description:
        "Okay I'll be the one to say it: do we even need an office?\n\nLet me share some numbers from our last 6 months:\n- Average office occupancy: 47%\n- Days where >80% of seats were used: 11 out of 130\n- Teams that are effectively full-remote already: DevOps, QA, the Munich contingent\n\nIf we go fully remote and invest the office budget into: coworking stipends (200 EUR/person/month), quarterly team meetups (budget the retreat money here), and better home office setups — we'd actually spend LESS while giving people what they clearly want.\n\nI know some managers worry about collaboration but our best quarter ever (Q3 2025) was when half the office had Covid and everyone worked from home.",
      summary: "Eliminate the office entirely, invest savings into remote work infrastructure.",
    },
    {
      title: "Hybrid Hub in Both Bucharest and Cluj",
      description:
        "We have 7 team members in Cluj already and we keep saying we want to hire more there. What if instead of one big office, we get two smaller spaces? \n\nI'm thinking:\n- Bucharest: ~400 sqm coworking deal at TechHub (they offered us 5,800/month for a dedicated floor)\n- Cluj: ~150 sqm at Cluj Innovation Park (2,100/month)\n\nTotal: 7,900/month — barely more than our current rent. And it opens up a whole new hiring pool. The Cluj tech scene is really strong right now, especially for backend engineers.",
      summary: "Open two smaller hubs in Bucharest and Cluj instead of one large office.",
    },
  ],

  "Annual Team Retreat": [
    {
      title: "Vama Veche Beach Retreat",
      description:
        "Let's do something different this year. Vama Veche in early September — still warm, the tourist crowds are gone, and it's way more relaxed than a mountain resort. I found a boutique hotel that can host all of us (Villa Albastra, they have a conference room too).\n\nCost estimate: ~850 EUR/person for 3 days\n- Accommodation: 120 EUR/night x 3\n- Team dinner at a seafood restaurant: 45 EUR/person\n- Activity options: beach volleyball tournament, kayaking, bonfire + retrospective\n- Travel: chartered bus from Bucharest (cheaper and more fun than individual cars)\n\nThe vibe would be more relaxed than Sinaia. Less hiking, more actual team bonding.",
      summary: "Beach retreat in Vama Veche for a relaxed bonding experience at 850 EUR/person.",
    },
    {
      title: "Brasov Adventure Retreat",
      description:
        "I'd vote for Brasov. Close enough that our international colleagues don't need a second flight, beautiful in late summer, and tons of activities:\n\n1. Day 1: Arrive, team lunch, strategy workshop at the hotel\n2. Day 2: Morning hike to Tampa Peak (easy trail, 2h), afternoon escape rooms in town (6 teams of 4!), dinner at a traditional Romanian restaurant\n3. Day 3: ATV tour through the hills, retrospective, awards ceremony\n\nBudget: ~1,100 EUR/person at Hotel & Spa & Co. They have a great wellness center too which people can use in the evenings.\n\nI organized the Sinaia retreat and took the feedback seriously — this time it's structured but with free time built in.",
      summary: "Adventure retreat in Brasov with hiking, escape rooms, and ATV tours at 1,100 EUR/person.",
    },
    {
      title: "Budapest Long Weekend",
      description:
        "Controversial take: let's go international. Budapest is a 90-minute flight from Bucharest, direct trains from multiple cities, and it's an incredible city for a team event. Ruin bars, thermal baths, great food scene.\n\nI found a deal for a boutique hotel in the Jewish Quarter — 95 EUR/night/room. For Stockholm and Munich people it's actually easier to reach than any Romanian mountain town.\n\nEstimated total: ~1,150 EUR/person including flights. Yes that's slightly over budget but we could save by doing 2 nights instead of 3.",
      summary: "International retreat in Budapest — central location, easier for remote team members.",
    },
    {
      title: "Villa Retreat in Maramures",
      description:
        "For those who want something truly unique — Maramures. I know it's remote but that's kind of the point. There's a restored traditional estate near Barsana that takes groups of up to 30. Wooden churches, rolling hills, home-cooked meals prepared by local families.\n\nNo escape rooms or ATV tours. Just a beautiful setting where we can actually talk to each other, do proper workshops, eat incredible food, and disconnect from screens for 3 days.\n\nCost: ~950 EUR/person. Main downside: it's a 7-hour drive or a flight to Baia Mare + 1.5h drive. But we could make the journey part of the experience (road trip in 5 minivans?).",
      summary: "Authentic Romanian countryside experience in Maramures, focused on connection.",
    },
    {
      title: "Skip the Retreat, Redistribute Budget",
      description:
        "Unpopular opinion time. Not everyone loves retreats. The introverts on the team (hi) find them exhausting. Parents with small kids struggle with 3-day trips. And honestly the ROI is unclear.\n\nWhat if instead we: take the 28K budget (1,200 x 23 people) and split it: 15K for a really nice 1-day event in Bucharest (fancy venue, great food, a fun activity), and 13K distributed as personal development budgets — conferences, courses, books, whatever each person wants. That way everyone benefits, not just the people who enjoy group travel.",
      summary: "Replace multi-day retreat with a 1-day event plus individual development budgets.",
    },
  ],

  "Tech Stack Migration": [
    {
      title: "Full Migration to Managed Kubernetes (GKE)",
      description:
        "I've been prototyping this on the side and I think Google Kubernetes Engine is our best bet. Here's why:\n\n- We already use GCP for storage and BigQuery\n- GKE Autopilot handles node management so we don't need a dedicated platform team\n- Cost estimate: ~2,400 EUR/month (vs ~1,800 current, but factor in the 3x downtime incidents which cost us way more)\n\nProposed migration phases:\n1. Set up GKE cluster + CI/CD pipeline (2 weeks)\n2. Migrate stateless services first — API gateway, auth, notification service (3 weeks)\n3. Migrate stateful services with proper PV setup — database, file storage (3 weeks)\n4. Decommission old servers (1 week)\n\nTotal timeline: ~9 weeks. I'd need 2 dedicated engineers.",
      summary: "Migrate all services to GKE Autopilot in a 9-week phased approach.",
    },
    {
      title: "Incremental Docker Compose + Traefik",
      description:
        "Do we really need Kubernetes? We have 12 services, not 120. K8s is incredibly complex and we don't have a single person with production K8s experience on the team.\n\nCounter-proposal: dockerize everything properly (some services still deploy as raw Node processes), use Docker Compose with Traefik as reverse proxy, and set up proper health checks + auto-restart. This solves 80% of our reliability problems at 10% of the complexity.\n\nCost: minimal — maybe 200 EUR/month for a slightly beefier server. Timeline: 3-4 weeks. And we can always migrate to K8s later once we actually outgrow this setup.",
      summary: "Dockerize with Docker Compose + Traefik instead of jumping to Kubernetes.",
    },
    {
      title: "Move to Railway or Fly.io (PaaS)",
      description:
        "Third option that nobody's talking about: just use a platform-as-a-service. Railway or Fly.io can run our dockerized services with zero infrastructure management from our side.\n\nI ran the numbers on Railway:\n- 12 services with current resource usage: ~1,800 EUR/month\n- Built-in CI/CD, monitoring, auto-scaling\n- Zero infrastructure maintenance\n- Deploys from git push\n\nWe're a product company, not an infrastructure company. Every hour we spend on K8s YAML is an hour not spent on features. I'd rather pay slightly more and have the platform handle everything.",
      summary: "Use Railway or Fly.io PaaS to eliminate infrastructure management entirely.",
    },
    {
      title: "Kubernetes but Self-Hosted on Hetzner",
      description:
        "If we're going K8s, we don't need GKE prices. Hetzner dedicated servers with k3s give us Kubernetes without the cloud provider markup. I've been running k3s at home and it's remarkably stable.\n\n3 nodes at Hetzner:\n- 2x AX42 (AMD Ryzen, 64GB RAM, 1TB NVMe): 50 EUR/month each\n- 1x AX52 for the database: 70 EUR/month\nTotal: 170 EUR/month vs 2,400 for GKE\n\nYes, we manage the cluster ourselves. But k3s is simple. And we save ~26K EUR per year. That's almost a junior engineer salary.\n\nThe tradeoff is real — more ops work for less money. But I think it's worth it.",
      summary: "Self-host k3s on Hetzner for Kubernetes at 170 EUR/month instead of 2,400.",
    },
  ],

  "Customer Onboarding": [
    {
      title: "Simplify to 3 Steps (Sign Up, Create Workspace, Invite)",
      description:
        "Our current onboarding has 7 steps. Seven! No wonder people drop off. I mapped out the minimum viable onboarding:\n\n1. Sign up (email + password, or SSO)\n2. Create your workspace (just a name, that's it)\n3. Invite your first teammate (with a \"skip for now\" option)\n\nEverything else — profile photo, notification prefs, project templates — can happen later through contextual prompts. The data shows that users who invite at least one person in the first session have 6x higher retention, so step 3 is critical.\n\nI can have mockups ready by Friday.",
      summary: "Reduce onboarding from 7 steps to 3 essential ones.",
    },
    {
      title: "Interactive Product Tour with Tooltips",
      description:
        "The problem isn't the number of steps, it's that users don't understand what they're setting up or why. I've used Appcues at my previous company and the results were dramatic — 40% improvement in onboarding completion.\n\nProposal: keep the current flow but add an interactive guided tour that explains each step with tooltips and progress indicators. We can build this in-house using a lightweight library (react-joyride is 8KB gzipped) or integrate Appcues (200 USD/month but saves engineering time).\n\nAlso: add a \"sample project\" that auto-populates so new users can see what a fully set-up workspace looks like before creating their own.",
      summary: "Add an interactive guided tour and sample project to existing onboarding flow.",
    },
    {
      title: "Template-Based Quick Start",
      description:
        "Most of our users fall into 3-4 use cases: product teams doing roadmap planning, leadership teams doing budget allocation, HR running engagement surveys, and agencies managing client projects. \n\nWhat if we ask users their use case upfront and give them a pre-built template? Like:\n\n\"What brings you to Ideate?\"\n- Planning a product roadmap → Template with sample sprints and prioritization\n- Making a team decision → Template with proposals and voting setup\n- Running a feedback session → Template with categories and anonymous mode\n\nThis way they go from signup to a populated workspace in under 60 seconds. I bet the drop-off at step 3 disappears because there's no blank-page problem.",
      summary: "Offer use-case templates so users start with a populated workspace instantly.",
    },
  ],

  "Budget Allocation": [
    {
      title: "Engineering 45% / Marketing 25% / HR 20% / Security 10%",
      description:
        "This is close to what the department heads requested. Here's my reasoning:\n\nEngineering (153K): They need 2 new hires (senior backend + DevOps) and the K8s migration will have infrastructure costs. This is the engine that drives everything.\n\nMarketing (85K): Q4 campaign is crucial — we're launching the enterprise tier and need pipeline. But they can optimize spend by cutting the underperforming Google Ads budget (currently burning 4K/month with poor conversion).\n\nHR (68K): L&D program is overdue. We've lost 3 people this year partly because of limited growth opportunities. Investing here is cheaper than replacing people.\n\nSecurity (34K): Penetration test + compliance audit. Not negotiable given our enterprise ambitions.",
      summary: "Allocate budget roughly as requested: engineering 45%, marketing 25%, HR 20%, security 10%.",
    },
    {
      title: "Engineering 55% / Marketing 20% / HR 15% / Security 10%",
      description:
        "Hear me out: we should overweight engineering significantly. The enterprise tier launch depends entirely on shipping the features customers are asking for — SSO, audit logs, advanced permissions, SLA guarantees. If engineering can't deliver these by Q4, marketing's campaign is wasted money anyway.\n\nSpecifically:\n- 187K for engineering: 3 hires instead of 2, plus infrastructure\n- 68K for marketing: focus on content marketing and partnerships (higher ROI than paid ads)\n- 51K for HR: L&D but scoped to engineering mentorship program first\n- 34K for security: same as other proposal\n\nMarketing won't love this but I'd rather have a great product to market than a mediocre product with a big ad budget.",
      summary: "Heavily invest in engineering (55%) since enterprise features gate all other plans.",
    },
    {
      title: "Equal Distribution with Performance Milestones",
      description:
        "Instead of fixed allocations, what about a milestone-based approach? Give each department a base allocation (70K each = 280K) and keep 60K as a performance pool.\n\nEach department sets 3 measurable milestones for H2. As they hit milestones, they unlock additional funding from the pool:\n- Engineering: Ship enterprise SSO by Aug, API v2 by Sep, 99.9% uptime Oct-Dec\n- Marketing: Generate 50 enterprise leads by Oct, reduce CAC by 15%, launch partner program\n- HR: 100% L&D participation, reduce time-to-hire to under 30 days, eNPS > 40\n- Security: Complete pen test, achieve SOC 2 Type I, zero critical incidents\n\nThis incentivizes execution over politics and gives us flexibility to redirect funds based on actual results.",
      summary: "Base allocation of 70K each, with 60K performance pool tied to measurable milestones.",
    },
    {
      title: "Defer Marketing Spend, Front-Load Security",
      description:
        "Controversial maybe but: we shouldn't spend big on marketing until security and compliance are solid. Two of our three lost enterprise deals cited security concerns. We don't have SOC 2, our pen test is 18 months old, and we store data in a single region.\n\nMy proposal:\n- Security: 80K (SOC 2 fast-track + pen test + multi-region + hire a security contractor for 6 months)\n- Engineering: 150K (as planned but with security-focused hiring)\n- HR: 68K (as planned)\n- Marketing: 42K (content-only, no paid campaigns until SOC 2 is done, probably November)\n\nThen in Q1 2027 we hit marketing hard WITH the SOC 2 badge and enterprise features ready. Timing is everything.",
      summary: "Prioritize security spend now, defer marketing until SOC 2 certification is complete.",
    },
  ],

  "Remote Work Policy": [
    {
      title: "3 Days Remote, 2 Days In-Office (Tuesday/Thursday)",
      description:
        "Looking at the survey data, the sweet spot seems to be 3 remote + 2 office. Tuesday and Thursday as office days makes sense because:\n\n- Monday is often catch-up/planning day (better at home)\n- Wednesday break keeps the week balanced\n- Friday... nobody wants to commute on Friday, let's be honest\n\nThe key is CONSISTENCY. The current policy fails because it's \"2 days in office but whenever you want\" which means you show up and your collaborators aren't there. Fixed days solve this.\n\nFor fully remote employees (Stockholm, Munich): they come in once a month for a full week, company covers travel. This is what GitLab and Basecamp do.",
      summary: "Fixed Tuesday/Thursday office days with 3 days remote for local employees.",
    },
    {
      title: "Fully Flexible with Team-Level Agreements",
      description:
        "One policy doesn't fit all teams. Engineering barely needs to be in the same room — they pair program over VS Code and communicate via Slack. Sales and customer success genuinely benefit from being together for role-play and coaching.\n\nProposal: each team lead defines their team's in-office schedule, minimum 1 day/week, max 5 days. They negotiate this with their team. Company-wide mandatory in-office: first Monday of each month for all-hands.\n\nThis respects team autonomy while keeping some company-wide rhythm. HR provides guidelines but doesn't police it. If a team's performance drops, the manager adjusts the policy. If it's fine, leave them alone.",
      summary: "Let each team define their own hybrid schedule with a 1-day minimum.",
    },
    {
      title: "Office-First with Remote Fridays",
      description:
        "I know this won't be popular but I think we've swung too far toward remote. Our cross-team collaboration has dropped measurably — look at the number of ad-hoc meetings (down 60%), hallway conversations that led to features (we used to track these — zero this quarter), and new employee integration (onboarding satisfaction is at an all-time low for 2025 hires).\n\nI'm proposing 4 days in office, Fridays remote. It's stricter than what most people want but the data supports it. The companies winning right now (not just big tech but startups too) are the ones where people actually see each other.\n\nException: fully remote positions remain fully remote with monthly visits. This isn't about surveillance, it's about serendipity.",
      summary: "Return to office-first (4 days) with remote Fridays to improve collaboration.",
    },
    {
      title: "Async-First, Location-Independent",
      description:
        "We should stop thinking about \"remote vs office\" and start thinking about \"sync vs async.\" The real problem isn't where people sit — it's that our communication patterns assume everyone is available at the same time.\n\nProposal: adopt async-first practices (written proposals over meetings, recorded presentations, 24h response SLA instead of instant), maintain the office as an optional resource (not a requirement), and measure output not presence.\n\nPractically: cancel all recurring meetings under 5 people (replace with async updates), invest in documentation culture, create office \"collaboration days\" that are opt-in not mandatory.\n\nThis works for all locations and timezones. It's harder than slapping a 2-day rule on things but it's the actual solution.",
      summary: "Shift to async-first communication, make office optional, measure output over presence.",
    },
  ],

  "Hackathon Results": [
    {
      title: "Fund the AI Customer Support Bot",
      description:
        "Team Skynet's customer support bot was the clear standout. In 3 days they built a prototype that:\n- Correctly answered 73% of test questions from our actual support inbox\n- Reduced average response time from 4 hours to 12 seconds\n- Had a clean UI that customers could actually use\n\nSupport tickets cost us roughly 8 EUR each to handle manually. If this bot handles even 50% of tier-1 tickets, the ROI is massive. I recommend allocating 2 engineers for 6 weeks to bring this to production.\n\nRunner-up consideration: the tech debt tracker is also great but it's more of an internal efficiency tool. Support bot has direct revenue impact.",
      summary: "Invest in the AI support bot — 73% accuracy prototype with clear ROI.",
    },
    {
      title: "Invest in the Tech Debt Tracker",
      description:
        "Yes the AI bot was flashy but the tech debt tracker solves a problem we've been ignoring for 2 years. Team Clean Code built a dashboard that scans our repos, identifies TODO/FIXME/HACK comments, links them to Jira tickets (or creates new ones), and visualizes debt trends over time.\n\nThis is the kind of tooling that makes good teams great. We currently have no visibility into our tech debt and it's growing silently. I'd argue this has MORE long-term impact than the support bot even if the ROI is harder to quantify.\n\n1 engineer, 4 weeks to polish and deploy.",
      summary: "The tech debt tracker addresses an invisible but growing problem in our codebase.",
    },
    {
      title: "Fund Both, Smaller Scope",
      description:
        "Why not both? Scope them down:\n\n- AI support bot: 1 engineer, 4 weeks, limited to the top 20 FAQ questions only (covers 60% of tier-1 tickets according to our support data). Skip the fancy UI for now, just integrate into Intercom.\n- Tech debt tracker: 1 engineer, 3 weeks, just the scanning + Jira integration. Dashboard can come later.\n\nTotal investment: 2 engineers for about a month each. Both projects have clear value. The hackathon was supposed to surface good ideas — let's not artificially limit ourselves to just one.",
      summary: "Fund both projects with reduced scope — 1 engineer each for 3-4 weeks.",
    },
  ],
};

/**
 * Create demo proposals for a specific project.
 * @param projectId The project to create proposals for
 * @param projectTitle The project title (used to match proposal templates)
 * @param userIds Array of user IDs to assign as proposal authors
 */
export function createProposals(
  projectId: string,
  projectTitle: string,
  userIds: string[],
): DemoProposal[] {
  // Find matching proposal set by prefix
  const matchKey = Object.keys(PROPOSAL_SETS).find((key) =>
    projectTitle.startsWith(key),
  );
  if (!matchKey) return [];

  const templates = PROPOSAL_SETS[matchKey];
  return templates.map((t, i) => ({
    id: randomUUID(),
    projectId,
    title: t.title,
    description: t.description,
    summary: t.summary,
    userId: userIds[i % userIds.length],
  }));
}

export function getProposalSets(): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, templates] of Object.entries(PROPOSAL_SETS)) {
    result[key] = templates.length;
  }
  return result;
}
