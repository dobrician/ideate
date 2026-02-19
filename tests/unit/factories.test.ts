import { describe, it, expect } from "vitest";
import { createUsers, getPersonaCount } from "@/lib/factories/users";
import { createProjects, getProjectTemplateCount } from "@/lib/factories/projects";
import { createProposals, getProposalSets } from "@/lib/factories/proposals";
import { createVotes } from "@/lib/factories/votes";
import { createComments } from "@/lib/factories/comments";
import { createTags, getProjectTagNames, getProposalTagNames, getTagCount } from "@/lib/factories/tags";

describe("User factory", () => {
  it("creates 20 personas by default", () => {
    const users = createUsers();
    expect(users).toHaveLength(20);
    expect(getPersonaCount()).toBe(20);
  });

  it("creates a subset when count is provided", () => {
    const users = createUsers(5);
    expect(users).toHaveLength(5);
  });

  it("produces valid user records", () => {
    const users = createUsers();
    for (const u of users) {
      expect(u.id).toBeTruthy();
      expect(u.email).toContain("@");
      expect(u.firstName).toBeTruthy();
      expect(u.lastName).toBeTruthy();
      expect(u.passwordHash).toBeTruthy();
      expect(u.emailVerified).toBe(true);
      expect(u.onboardingCompleted).toBe(true);
      expect(["admin", "manager", "member", "viewer"]).toContain(u.role);
    }
  });

  it("generates unique IDs and emails", () => {
    const users = createUsers();
    const ids = new Set(users.map((u) => u.id));
    const emails = new Set(users.map((u) => u.email));
    expect(ids.size).toBe(20);
    expect(emails.size).toBe(20);
  });

  it("includes a mix of roles", () => {
    const users = createUsers();
    const roles = new Set(users.map((u) => u.role));
    expect(roles).toContain("admin");
    expect(roles).toContain("manager");
    expect(roles).toContain("member");
    expect(roles).toContain("viewer");
  });

  it("includes Romanian and international names", () => {
    const users = createUsers();
    const emails = users.map((u) => u.email);
    const roEmails = emails.filter((e) => e.endsWith("@ideate.ro"));
    const intlEmails = emails.filter((e) => e.endsWith("@techcorp.com"));
    expect(roEmails.length).toBeGreaterThan(5);
    expect(intlEmails.length).toBeGreaterThan(3);
  });
});

describe("Project factory", () => {
  it("creates all project templates by default", () => {
    const userIds = ["u1", "u2", "u3"];
    const projects = createProjects(userIds);
    expect(projects).toHaveLength(getProjectTemplateCount());
    expect(projects.length).toBeGreaterThanOrEqual(5);
    expect(projects.length).toBeLessThanOrEqual(8);
  });

  it("creates a subset when count is provided", () => {
    const projects = createProjects(["u1"], 3);
    expect(projects).toHaveLength(3);
  });

  it("produces valid project records", () => {
    const projects = createProjects(["u1", "u2"]);
    for (const p of projects) {
      expect(p.id).toBeTruthy();
      expect(p.title).toBeTruthy();
      expect(p.description.length).toBeGreaterThan(50);
      expect(p.summary).toBeTruthy();
      expect(p.deadline).toBeInstanceOf(Date);
      expect(["active", "archived", "draft"]).toContain(p.status);
      expect(p.userId).toBeTruthy();
    }
  });

  it("assigns owners round-robin", () => {
    const projects = createProjects(["u1", "u2"], 4);
    expect(projects[0].userId).toBe("u1");
    expect(projects[1].userId).toBe("u2");
    expect(projects[2].userId).toBe("u1");
    expect(projects[3].userId).toBe("u2");
  });

  it("generates unique IDs", () => {
    const projects = createProjects(["u1"]);
    const ids = new Set(projects.map((p) => p.id));
    expect(ids.size).toBe(projects.length);
  });
});

describe("Proposal factory", () => {
  it("creates proposals for each project", () => {
    const sets = getProposalSets();
    for (const [prefix, count] of Object.entries(sets)) {
      const proposals = createProposals("proj-1", prefix + " Test", ["u1", "u2", "u3"]);
      expect(proposals).toHaveLength(count);
      expect(count).toBeGreaterThanOrEqual(3);
      expect(count).toBeLessThanOrEqual(8);
    }
  });

  it("produces valid proposal records", () => {
    const proposals = createProposals("proj-1", "Q2 Product Roadmap 2026", ["u1", "u2", "u3"]);
    for (const p of proposals) {
      expect(p.id).toBeTruthy();
      expect(p.projectId).toBe("proj-1");
      expect(p.title).toBeTruthy();
      expect(p.description.length).toBeGreaterThan(100);
      expect(p.summary).toBeTruthy();
      expect(p.userId).toBeTruthy();
    }
  });

  it("assigns different authors", () => {
    const proposals = createProposals("proj-1", "Q2 Product Roadmap 2026", ["u1", "u2", "u3", "u4", "u5"]);
    const authors = new Set(proposals.map((p) => p.userId));
    expect(authors.size).toBeGreaterThan(1);
  });

  it("returns empty for unknown project", () => {
    const proposals = createProposals("proj-1", "Unknown Project", ["u1"]);
    expect(proposals).toHaveLength(0);
  });
});

describe("Vote factory", () => {
  it("creates votes for proposals", () => {
    const proposalMap = new Map([
      ["p1", "Prioritize Mobile App Redesign"],
      ["p2", "Go Fully Remote"],
    ]);
    const voterIds = Array.from({ length: 16 }, (_, i) => `v${i}`);
    const votes = createVotes(proposalMap, voterIds);
    expect(votes.length).toBeGreaterThan(0);
  });

  it("produces valid vote records", () => {
    const proposalMap = new Map([["p1", "Prioritize Mobile App Redesign"]]);
    const voterIds = Array.from({ length: 10 }, (_, i) => `v${i}`);
    const votes = createVotes(proposalMap, voterIds);

    for (const v of votes) {
      expect(v.proposalId).toBe("p1");
      expect(v.userId).toBeTruthy();
      expect([1, -1]).toContain(v.value);
    }
  });

  it("popular proposals get more positive votes", () => {
    const proposalMap = new Map([["p1", "Prioritize Mobile App Redesign"]]);
    const voterIds = Array.from({ length: 20 }, (_, i) => `v${i}`);
    const votes = createVotes(proposalMap, voterIds);

    const forVotes = votes.filter((v) => v.value === 1).length;
    const againstVotes = votes.filter((v) => v.value === -1).length;
    expect(forVotes).toBeGreaterThan(againstVotes);
  });

  it("does not create duplicate voter-proposal pairs", () => {
    const proposalMap = new Map([["p1", "Go Fully Remote"]]);
    const voterIds = Array.from({ length: 20 }, (_, i) => `v${i}`);
    const votes = createVotes(proposalMap, voterIds);

    const pairs = new Set(votes.map((v) => `${v.proposalId}:${v.userId}`));
    expect(pairs.size).toBe(votes.length);
  });
});

describe("Comment factory", () => {
  it("creates threaded comments for proposals", () => {
    const proposals = [
      { id: "p1", title: "Prioritize Mobile App Redesign", projectId: "proj-1" },
      { id: "p2", title: "Go Fully Remote", projectId: "proj-2" },
    ];
    const userIds = Array.from({ length: 20 }, (_, i) => `u${i}`);
    const comments = createComments(proposals, userIds);
    expect(comments.length).toBeGreaterThan(0);
  });

  it("produces valid comment records", () => {
    const proposals = [
      { id: "p1", title: "Prioritize Mobile App Redesign", projectId: "proj-1" },
    ];
    const userIds = Array.from({ length: 20 }, (_, i) => `u${i}`);
    const comments = createComments(proposals, userIds);

    for (const c of comments) {
      expect(c.id).toBeTruthy();
      expect(c.proposalId).toBe("p1");
      expect(c.content).toBeTruthy();
      expect(c.content.length).toBeGreaterThan(10);
      expect(c.userId).toBeTruthy();
    }
  });

  it("creates replies with parent IDs", () => {
    const proposals = [
      { id: "p1", title: "Prioritize Mobile App Redesign", projectId: "proj-1" },
    ];
    const userIds = Array.from({ length: 20 }, (_, i) => `u${i}`);
    const comments = createComments(proposals, userIds);

    const rootComments = comments.filter((c) => c.parentId === null);
    const replies = comments.filter((c) => c.parentId !== null);
    expect(rootComments.length).toBeGreaterThan(0);
    expect(replies.length).toBeGreaterThan(0);

    // Replies should reference valid parent IDs
    const commentIds = new Set(comments.map((c) => c.id));
    for (const reply of replies) {
      expect(commentIds.has(reply.parentId!)).toBe(true);
    }
  });
});

describe("Tag factory", () => {
  it("creates the full tag taxonomy", () => {
    const tags = createTags();
    expect(tags.length).toBe(getTagCount());
    expect(tags.length).toBeGreaterThanOrEqual(15);
  });

  it("produces valid tag records", () => {
    const tags = createTags();
    for (const t of tags) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.name).not.toContain(" "); // kebab-case
    }
  });

  it("generates unique names", () => {
    const tags = createTags();
    const names = new Set(tags.map((t) => t.name));
    expect(names.size).toBe(tags.length);
  });

  it("returns project tag names for known projects", () => {
    const tagNames = getProjectTagNames("Q2 Product Roadmap 2026");
    expect(tagNames.length).toBeGreaterThan(0);
    expect(tagNames).toContain("product");
  });

  it("returns proposal tag names for known proposals", () => {
    const tagNames = getProposalTagNames("Go Fully Remote");
    expect(tagNames.length).toBeGreaterThan(0);
    expect(tagNames).toContain("people");
  });

  it("returns empty for unknown titles", () => {
    expect(getProjectTagNames("Unknown Project")).toHaveLength(0);
    expect(getProposalTagNames("Unknown Proposal")).toHaveLength(0);
  });
});
