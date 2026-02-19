import { randomUUID } from "crypto";

export interface DemoProject {
  id: string;
  title: string;
  description: string;
  summary: string;
  deadline: Date;
  status: "active" | "archived" | "draft";
  userId: string;
}

interface ProjectTemplate {
  title: string;
  description: string;
  summary: string;
  daysUntilDeadline: number;
  status: "active" | "archived" | "draft";
}

const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    title: "Q2 Product Roadmap 2026",
    description:
      "Define the product roadmap for Q2 2026. We need to align engineering, design, and product teams on priorities. Key areas: mobile app improvements, API v2 launch, and the new analytics dashboard. Budget has been pre-approved for up to 3 major initiatives.",
    summary: "Prioritize Q2 product initiatives across engineering, design, and product teams.",
    daysUntilDeadline: 45,
    status: "active",
  },
  {
    title: "Office Relocation Plan",
    description:
      "Our lease at Calea Victoriei 78 expires in September. We need to decide whether to renew, relocate, or go hybrid/remote. Current office fits 40 people but we're growing to 55+ by year end. The facilities team has done preliminary research on 3 locations in Bucharest and 1 option in Cluj-Napoca.",
    summary: "Decide on office space strategy before the current lease expires in September.",
    daysUntilDeadline: 90,
    status: "active",
  },
  {
    title: "Annual Team Retreat 2026",
    description:
      "Plan the annual team retreat for late summer 2026. Last year we went to Sinaia and feedback was mixed — some loved the hiking, others wanted more structured activities. Budget is roughly 1200 EUR per person for a 3-day event. We have remote team members in Stockholm and Munich who need to fly in.",
    summary: "Choose destination and format for the 2026 annual team retreat.",
    daysUntilDeadline: 120,
    status: "active",
  },
  {
    title: "Tech Stack Migration to Kubernetes",
    description:
      "Evaluate moving our infrastructure from the current VPS setup to Kubernetes. We're running 12 microservices on 4 bare-metal servers with manual deploys. Downtime incidents have increased 3x this quarter. The DevOps team proposes a phased migration but we need buy-in from engineering leads on timeline and priorities.",
    summary: "Evaluate and plan the migration from VPS infrastructure to Kubernetes.",
    daysUntilDeadline: 60,
    status: "active",
  },
  {
    title: "Customer Onboarding Redesign",
    description:
      "Our onboarding flow has a 34% drop-off rate at step 3 (team setup). Competitors average 18%. Product analytics show users who complete onboarding have 4x higher retention. We need proposals for simplifying the flow, adding better guidance, and possibly introducing a guided tour or wizard.",
    summary: "Reduce onboarding drop-off from 34% to under 20% through UX improvements.",
    daysUntilDeadline: 30,
    status: "active",
  },
  {
    title: "Budget Allocation 2026 H2",
    description:
      "Allocate the remaining H2 2026 budget across departments. Total available: 340K EUR. Engineering is requesting 45% for infrastructure and hiring, Marketing wants 25% for the Q4 campaign, and HR needs funding for the new L&D program. We also have a contingency request from the security team.",
    summary: "Distribute 340K EUR H2 budget across engineering, marketing, HR, and security.",
    daysUntilDeadline: 75,
    status: "active",
  },
  {
    title: "Remote Work Policy Update",
    description:
      "Review and update the company remote work policy. Current policy allows 2 days/week remote but enforcement is inconsistent. Some teams are effectively fully remote while others require daily presence. We've received feedback from 67% of employees through the recent survey — most want more flexibility but managers have concerns about collaboration.",
    summary: "Update remote work policy based on employee survey and manager feedback.",
    daysUntilDeadline: 21,
    status: "active",
  },
  {
    title: "Q1 Hackathon Results",
    description:
      "Review proposals from the Q1 internal hackathon. 8 teams participated over 3 days and built prototypes ranging from an AI-powered customer support bot to an internal tool for tracking tech debt. We need to decide which 2-3 projects get continued investment and team allocation.",
    summary: "Select top hackathon projects for continued investment.",
    daysUntilDeadline: -15,
    status: "archived",
  },
];

/**
 * Create demo project records ready for DB insertion.
 * @param userIds Array of user IDs to assign as project owners (round-robin)
 * @param count Number of projects to create (default: all templates)
 */
export function createProjects(
  userIds: string[],
  count?: number,
): DemoProject[] {
  const templates = count ? PROJECT_TEMPLATES.slice(0, count) : PROJECT_TEMPLATES;
  const now = Date.now();

  return templates.map((t, i) => ({
    id: randomUUID(),
    title: t.title,
    description: t.description,
    summary: t.summary,
    deadline: new Date(now + t.daysUntilDeadline * 24 * 60 * 60 * 1000),
    status: t.status,
    userId: userIds[i % userIds.length],
  }));
}

export function getProjectTemplateCount(): number {
  return PROJECT_TEMPLATES.length;
}
