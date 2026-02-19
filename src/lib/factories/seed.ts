/**
 * Core seeding logic shared by the CLI script and the API route.
 * Inserts demo data using the factory functions and Drizzle ORM.
 */
import { db } from "@/db";
import {
  users,
  projects,
  proposals,
  votes,
  comments,
  tags,
  projectTags,
  proposalTags,
} from "@/db/schema";
import {
  createUsers,
  createProjects,
  createProposals,
  createVotes,
  createComments,
  createTags,
  getProjectTagNames,
  getProposalTagNames,
} from "./index";
import { sql } from "drizzle-orm";

export interface SeedResult {
  users: number;
  projects: number;
  proposals: number;
  votes: number;
  comments: number;
  tags: number;
  projectTags: number;
  proposalTags: number;
}

/**
 * Delete all demo-related data from the database.
 * Uses cascading deletes where possible.
 */
export async function cleanDemoData(): Promise<void> {
  // Delete in reverse dependency order
  // Votes, comments, proposal_tags, project_tags will cascade from proposals/projects
  // But we delete explicitly to be safe
  await db.delete(votes);
  await db.delete(comments);
  await db.delete(proposalTags);
  await db.delete(projectTags);
  await db.delete(proposals);
  await db.delete(projects);
  await db.delete(tags);
  await db.delete(users);
}

/**
 * Seed the database with realistic demo data.
 * @param clean If true, deletes all existing data first.
 */
export async function seedDemoData(clean = true): Promise<SeedResult> {
  if (clean) {
    await cleanDemoData();
  }

  // 1. Create users
  const demoUsers = createUsers();
  for (const u of demoUsers) {
    await db.insert(users).values(u);
  }
  const userIds = demoUsers.map((u) => u.id);

  // Use managers and admins as project owners
  const ownerIds = demoUsers
    .filter((u) => u.role === "admin" || u.role === "manager")
    .map((u) => u.id);

  // 2. Create projects
  const demoProjects = createProjects(ownerIds);
  for (const p of demoProjects) {
    await db.insert(projects).values(p);
  }

  // 3. Create tags
  const demoTags = createTags();
  for (const t of demoTags) {
    await db.insert(tags).values(t);
  }
  const tagNameToId = new Map(demoTags.map((t) => [t.name, t.id]));

  // 4. Assign tags to projects
  let projectTagCount = 0;
  for (const project of demoProjects) {
    const tagNames = getProjectTagNames(project.title);
    for (const name of tagNames) {
      const tagId = tagNameToId.get(name);
      if (tagId) {
        await db.insert(projectTags).values({ projectId: project.id, tagId });
        projectTagCount++;
      }
    }
  }

  // 5. Create proposals (use different users as authors)
  // Spread proposals across different users for variety
  const memberIds = demoUsers
    .filter((u) => u.role === "member" || u.role === "manager")
    .map((u) => u.id);

  const allProposals: { id: string; title: string; projectId: string }[] = [];

  for (const project of demoProjects) {
    // Shuffle member IDs for variety per project
    const shuffled = [...memberIds].sort(() => Math.random() - 0.5);
    const demoProposals = createProposals(project.id, project.title, shuffled);
    for (const p of demoProposals) {
      await db.insert(proposals).values(p);
      allProposals.push({ id: p.id, title: p.title, projectId: project.id });
    }
  }

  // 6. Assign tags to proposals
  let proposalTagCount = 0;
  for (const proposal of allProposals) {
    const tagNames = getProposalTagNames(proposal.title);
    for (const name of tagNames) {
      const tagId = tagNameToId.get(name);
      if (tagId) {
        await db.insert(proposalTags).values({ proposalId: proposal.id, tagId });
        proposalTagCount++;
      }
    }
  }

  // 7. Create votes (all non-viewer users can vote)
  const voterIds = demoUsers
    .filter((u) => u.role !== "viewer")
    .map((u) => u.id);
  const proposalMap = new Map(allProposals.map((p) => [p.id, p.title]));
  const demoVotes = createVotes(proposalMap, voterIds);
  for (const v of demoVotes) {
    await db.insert(votes).values(v);
  }

  // 8. Create comments
  const demoComments = createComments(allProposals, userIds);
  for (const c of demoComments) {
    await db.insert(comments).values(c);
  }

  // 9. Rebuild FTS indexes so new data is searchable
  try {
    await db.run(sql`INSERT INTO projects_fts(projects_fts) VALUES('rebuild')`);
    await db.run(sql`INSERT INTO proposals_fts(proposals_fts) VALUES('rebuild')`);
    await db.run(sql`INSERT INTO comments_fts(comments_fts) VALUES('rebuild')`);
  } catch {
    // FTS tables might not exist
  }

  return {
    users: demoUsers.length,
    projects: demoProjects.length,
    proposals: allProposals.length,
    votes: demoVotes.length,
    comments: demoComments.length,
    tags: demoTags.length,
    projectTags: projectTagCount,
    proposalTags: proposalTagCount,
  };
}
