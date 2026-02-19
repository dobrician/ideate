import { randomUUID } from "crypto";

export interface DemoComment {
  id: string;
  proposalId: string;
  projectId: string | null;
  parentId: string | null;
  content: string;
  userId: string;
}

interface CommentThread {
  content: string;
  /** Index into userIds array for author selection */
  authorIdx: number;
  replies?: CommentThread[];
}

// Each key maps to a proposal title prefix
const COMMENT_THREADS: Record<string, CommentThread[]> = {
  "Prioritize Mobile App Redesign": [
    {
      content: "Totally agree on this. Our biggest client (the one with 200 users) has been asking about mobile improvements in every monthly call since January.",
      authorIdx: 2,
      replies: [
        {
          content: "Which client? I want to make sure we're referencing the same feedback.",
          authorIdx: 5,
          replies: [
            {
              content: "NovaTech. They also mentioned they'd upgrade to enterprise tier if we shipped offline mode.",
              authorIdx: 2,
            },
          ],
        },
      ],
    },
    {
      content: "Have we considered React Native for this instead of going full native? Would be faster to ship and we already have the React expertise.",
      authorIdx: 8,
      replies: [
        {
          content: "RN performance has gotten a lot better with the new architecture. I'd support that approach.",
          authorIdx: 10,
        },
        {
          content: "The new arch is still unstable for some libraries. I'd prototype first before committing.",
          authorIdx: 13,
        },
      ],
    },
  ],

  "Launch API v2 First": [
    {
      content: "Can we get a list of which integration partners are at risk? That would help prioritize.",
      authorIdx: 3,
      replies: [
        {
          content: "I'll put together a doc. Off the top of my head: DataSync (they're evaluating Notion API), FlowBuilder (their CTO emailed me last week), and possibly IntegratePro.",
          authorIdx: 5,
        },
      ],
    },
    {
      content: "The 10-week timeline feels optimistic. Auth alone took us 4 weeks for v1. What's different this time?",
      authorIdx: 9,
      replies: [
        {
          content: "Good question. We have the auth patterns established now and we're not changing the token format. The v2 auth is mostly adding scopes/permissions on top of what exists.",
          authorIdx: 6,
          replies: [
            {
              content: "Makes sense. I'd still pad the estimate by 2 weeks for the inevitable surprises.",
              authorIdx: 9,
            },
          ],
        },
      ],
    },
    {
      content: "We should make sure v2 has proper rate limiting from day one. The v1 rate limiter is basically a joke.",
      authorIdx: 7,
    },
  ],

  "Go Fully Remote": [
    {
      content: "I've been fully remote for 2 years and honestly it works great. The tools are there. If anything, forcing me into an office 2x/week makes me LESS productive because of the commute.",
      authorIdx: 11,
      replies: [
        {
          content: "That's fair for experienced devs, but what about junior hires? I mentored two juniors this year and it was really hard to do remotely.",
          authorIdx: 4,
          replies: [
            {
              content: "We could have a mentorship program with optional in-person days for juniors. Don't punish the whole company for an onboarding problem.",
              authorIdx: 11,
            },
            {
              content: "Actually our best junior this year (Ana) was remote from day one and she's doing great. Maybe it's about the mentorship process not the location.",
              authorIdx: 7,
            },
          ],
        },
      ],
    },
    {
      content: "What happens to the people who actually WANT to go to an office? Some of us have tiny apartments. Working from home isn't a perk for everyone.",
      authorIdx: 14,
      replies: [
        {
          content: "That's what the coworking stipend would cover. 200 EUR/month gets you a nice desk at any coworking space.",
          authorIdx: 0,
        },
      ],
    },
  ],

  "Move to Pipera Business District": [
    {
      content: "I live in Militari. Pipera would add 45 minutes to my commute each way. Can we at least get a survey on where people actually live before deciding?",
      authorIdx: 12,
      replies: [
        {
          content: "Good point. I'll set up a quick form. Should take 5 minutes for everyone to fill out.",
          authorIdx: 2,
        },
        {
          content: "I'm in Titan, same problem. Would flexible hours help? Like if I could come in 10-6 instead of 9-5, the metro would be way less crowded.",
          authorIdx: 15,
        },
      ],
    },
    {
      content: "The floor plan looks amazing. Those meeting rooms are exactly what we need. Can we negotiate on the parking? 25 spots for 50+ people is rough.",
      authorIdx: 3,
      replies: [
        {
          content: "I asked — they said 10 more spots are available at 100 EUR/month each. Not great but there's also a public parking garage next door.",
          authorIdx: 1,
        },
      ],
    },
  ],

  "Simplify to 3 Steps": [
    {
      content: "Love this. But the team setup step is where we collect info we actually need — team size, industry, use case. If we skip it, how do we personalize the experience later?",
      authorIdx: 3,
      replies: [
        {
          content: "We could ask those questions contextually later. Like when they create their first project, we can ask \"what kind of project is this?\" instead of front-loading it.",
          authorIdx: 6,
          replies: [
            {
              content: "This is basically progressive profiling. I've seen it work well at other SaaS companies. +1",
              authorIdx: 8,
            },
          ],
        },
      ],
    },
    {
      content: "The \"invite your first teammate\" step needs to be optional. Some users are evaluating the tool alone first. Forcing social proof before they've even seen the product is aggressive.",
      authorIdx: 10,
      replies: [
        {
          content: "Agreed — that's why I mentioned the \"skip for now\" option. It should be encouraged but not required.",
          authorIdx: 6,
        },
      ],
    },
  ],

  "Equal Distribution with Performance Milestones": [
    {
      content: "I really like the milestone approach. But who decides when a milestone is \"met\"? We need clear, measurable criteria agreed upfront or this becomes political.",
      authorIdx: 4,
      replies: [
        {
          content: "Each milestone would be reviewed by the leadership team monthly. Criteria should be quantitative — 99.9% uptime is either met or it isn't. No subjective judgment.",
          authorIdx: 1,
          replies: [
            {
              content: "Some of these are hard to make purely quantitative though. \"Launch partner program\" — what counts as launched? 1 partner? 10?",
              authorIdx: 7,
            },
            {
              content: "Fair. Let's define each milestone with a specific deliverable and a measurable outcome. I'll draft this for review.",
              authorIdx: 1,
            },
          ],
        },
      ],
    },
    {
      content: "70K base seems too low for engineering. They can barely cover one new hire with that. The base should reflect minimum viable operation for each team.",
      authorIdx: 6,
    },
  ],

  "3 Days Remote, 2 Days In-Office": [
    {
      content: "Tuesday + Thursday makes sense. But can we make sure the office days have actual collaborative value? Last time we had \"office days\" I sat in Zoom meetings all day from my desk. Pointless.",
      authorIdx: 9,
      replies: [
        {
          content: "Good call. What if we designate office days as meeting-free zones (no scheduled Zooms) and instead encourage in-person workshops, pair programming, and ad-hoc collaboration?",
          authorIdx: 3,
          replies: [
            {
              content: "Love that. Office days = collaboration days, remote days = focus days. Sell it like that and people will actually want to come in.",
              authorIdx: 8,
            },
          ],
        },
      ],
    },
  ],

  "Full Migration to Managed Kubernetes": [
    {
      content: "9 weeks is aggressive. At my last company a similar migration took 5 months. What's your contingency if phase 2 takes longer than expected?",
      authorIdx: 10,
      replies: [
        {
          content: "Good question. We'd keep the old servers running in parallel until each service is validated in K8s. Worst case we rollback a single service, not the whole thing.",
          authorIdx: 7,
          replies: [
            {
              content: "Running parallel infrastructure will roughly double our hosting costs during migration. Just making sure that's budgeted.",
              authorIdx: 4,
            },
          ],
        },
      ],
    },
    {
      content: "Who has K8s experience on the team? I've done some hobby projects but never production. Are we planning to hire or upskill?",
      authorIdx: 13,
      replies: [
        {
          content: "I ran K8s in production at my last job for 2 years. Happy to lead this if we go this route. But I agree we need at least one more person with hands-on experience.",
          authorIdx: 7,
        },
      ],
    },
  ],

  "Incremental Docker Compose": [
    {
      content: "This is the pragmatic choice. We don't need to solve all our problems at once. Docker Compose is boring and that's exactly why it works.",
      authorIdx: 6,
      replies: [
        {
          content: "Boring is underrated in infrastructure. I'm tired of resume-driven development decisions.",
          authorIdx: 9,
        },
      ],
    },
    {
      content: "One concern: Docker Compose doesn't handle zero-downtime deploys well out of the box. We'd need to set up blue-green or rolling deploys manually.",
      authorIdx: 7,
      replies: [
        {
          content: "Traefik actually handles this pretty well with health checks. You bring up the new container, Traefik routes traffic once it's healthy, then you stop the old one. I've done this before.",
          authorIdx: 10,
        },
      ],
    },
  ],

  "Fund the AI Customer Support Bot": [
    {
      content: "73% accuracy sounds impressive for a hackathon but it means 27% wrong answers going to customers. That's a brand risk we need to think about carefully.",
      authorIdx: 3,
      replies: [
        {
          content: "We'd obviously have a confidence threshold. Low-confidence answers get routed to a human. The bot would handle the clear-cut stuff and escalate everything else.",
          authorIdx: 7,
          replies: [
            {
              content: "Makes sense. What confidence threshold were you thinking? And have you tested what percentage of queries fall below it?",
              authorIdx: 3,
            },
            {
              content: "In the hackathon prototype we set it at 0.85. About 40% of queries exceeded that threshold. So it would handle 4 out of 10 tickets automatically. Still a big win.",
              authorIdx: 7,
            },
          ],
        },
      ],
    },
  ],

  "Vama Veche Beach Retreat": [
    {
      content: "September in Vama Veche is perfect. Not too hot, empty beaches. And the nightlife is fun if people want it but totally optional.",
      authorIdx: 11,
      replies: [
        {
          content: "Do they have reliable wifi at that hotel? We might need some people to be reachable for client emergencies.",
          authorIdx: 4,
          replies: [
            {
              content: "I called them. They have 200 Mbps fiber. Also, the whole point of a retreat is to disconnect. Let's set up an on-call rotation and let everyone else be offline.",
              authorIdx: 11,
            },
          ],
        },
      ],
    },
    {
      content: "850 EUR is well under budget. Can we use the savings for a surprise activity or something special?",
      authorIdx: 14,
    },
  ],

  "Template-Based Quick Start": [
    {
      content: "This is basically what Notion does and it works incredibly well. New users immediately see the value because the workspace isn't empty.",
      authorIdx: 8,
      replies: [
        {
          content: "Exactly. The blank page problem is real. Nobody knows what to do with an empty project. Templates solve that instantly.",
          authorIdx: 6,
        },
      ],
    },
    {
      content: "We'd need to maintain these templates though. Every time we add a feature the templates need updating. That's ongoing work.",
      authorIdx: 10,
      replies: [
        {
          content: "True but it's minimal. Update templates once per quarter when we do major releases. Small price for better onboarding.",
          authorIdx: 3,
        },
      ],
    },
  ],
};

/**
 * Create demo comments for a list of proposals.
 * @param proposals Array of { id, title, projectId }
 * @param userIds All user IDs (authors are picked by index from thread definitions)
 */
export function createComments(
  proposals: { id: string; title: string; projectId: string }[],
  userIds: string[],
): DemoComment[] {
  const allComments: DemoComment[] = [];

  for (const proposal of proposals) {
    const matchKey = Object.keys(COMMENT_THREADS).find((key) =>
      proposal.title.startsWith(key),
    );
    if (!matchKey) continue;

    const threads = COMMENT_THREADS[matchKey];
    for (const thread of threads) {
      flattenThread(thread, null, proposal.id, proposal.projectId, userIds, allComments);
    }
  }

  return allComments;
}

function flattenThread(
  thread: CommentThread,
  parentId: string | null,
  proposalId: string,
  projectId: string,
  userIds: string[],
  out: DemoComment[],
): void {
  const id = randomUUID();
  out.push({
    id,
    proposalId,
    projectId: null,
    parentId,
    content: thread.content,
    userId: userIds[thread.authorIdx % userIds.length],
  });

  if (thread.replies) {
    for (const reply of thread.replies) {
      flattenThread(reply, id, proposalId, projectId, userIds, out);
    }
  }
}

export function getCommentThreadCount(): number {
  return Object.keys(COMMENT_THREADS).length;
}
