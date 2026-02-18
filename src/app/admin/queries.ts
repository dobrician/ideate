import { db } from "@/db";
import { users, projects, auditLogs, invitations, tags, webhooks, projectTemplates, teams, teamMembers, customRoles } from "@/db/schema";
import { desc, asc, eq, sql } from "drizzle-orm";

export async function getAdminData() {
  const [allUsers, stats, recentAudit, pendingInvitations, allProjects, allTags, allWebhooks, allTemplates, allTeamsRaw, allCustomRolesRaw] = await Promise.all([
    db.select({
      id: users.id, email: users.email, firstName: users.firstName,
      lastName: users.lastName, role: users.role, createdAt: users.createdAt,
    }).from(users).orderBy(desc(users.createdAt)),

    db.select({
      userCount: sql<number>`(SELECT COUNT(*) FROM users)`,
      projectCount: sql<number>`(SELECT COUNT(*) FROM projects)`,
      proposalCount: sql<number>`(SELECT COUNT(*) FROM proposals)`,
      voteCount: sql<number>`(SELECT COUNT(*) FROM votes)`,
      commentCount: sql<number>`(SELECT COUNT(*) FROM comments)`,
    }).from(sql`(SELECT 1)`),

    db.select({
      id: auditLogs.id, action: auditLogs.action, entity: auditLogs.entity,
      entityId: auditLogs.entityId, details: auditLogs.details,
      createdAt: auditLogs.createdAt, userEmail: users.email,
    }).from(auditLogs)
      .leftJoin(users, sql`${auditLogs.userId} = ${users.id}`)
      .orderBy(desc(auditLogs.createdAt)).limit(20),

    db.select({
      id: invitations.id, email: invitations.email, status: invitations.status,
      expiresAt: invitations.expiresAt, createdAt: invitations.createdAt,
      inviterEmail: users.email,
    }).from(invitations)
      .leftJoin(users, eq(invitations.invitedBy, users.id))
      .orderBy(desc(invitations.createdAt)),

    db.select({
      id: projects.id, title: projects.title, status: projects.status,
      createdAt: projects.createdAt,
    }).from(projects).orderBy(desc(projects.createdAt)),

    db.select({ id: tags.id, name: tags.name }).from(tags).orderBy(asc(tags.name)),

    db.select().from(webhooks).orderBy(desc(webhooks.createdAt)),

    db.select().from(projectTemplates).orderBy(desc(projectTemplates.createdAt)),

    db.select({
      id: teams.id, name: teams.name, slug: teams.slug, description: teams.description,
      memberId: teamMembers.userId, memberRole: teamMembers.role,
      memberEmail: users.email, memberFirst: users.firstName,
    }).from(teams)
      .leftJoin(teamMembers, eq(teams.id, teamMembers.teamId))
      .leftJoin(users, eq(teamMembers.userId, users.id))
      .orderBy(desc(teams.createdAt)),

    db.select({
      id: customRoles.id, name: customRoles.name,
      description: customRoles.description, permissions: customRoles.permissions,
      isSystem: customRoles.isSystem,
    }).from(customRoles).orderBy(asc(customRoles.name)),
  ]);

  // Group teams with their members
  type TeamData = { id: string; name: string; slug: string; description: string | null; members: { userId: string; email: string; firstName: string | null; role: string }[] };
  const teamsMap = new Map<string, TeamData>();
  for (const row of allTeamsRaw) {
    if (!teamsMap.has(row.id)) {
      teamsMap.set(row.id, { id: row.id, name: row.name, slug: row.slug, description: row.description, members: [] });
    }
    if (row.memberId) {
      teamsMap.get(row.id)!.members.push({ userId: row.memberId, email: row.memberEmail ?? "", firstName: row.memberFirst, role: row.memberRole ?? "member" });
    }
  }

  const allRoles = allCustomRolesRaw.map((r) => ({
    ...r, permissions: JSON.parse(r.permissions) as string[],
    isSystem: Boolean(r.isSystem),
  }));

  return {
    allUsers, stats: stats[0], recentAudit, pendingInvitations,
    allProjects, allTags, allWebhooks, allTemplates,
    allTeams: Array.from(teamsMap.values()), allRoles,
  };
}
