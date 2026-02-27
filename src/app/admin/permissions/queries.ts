import { db } from "@/db";
import { permissionRules, resourceAcls, users } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export async function getPermissionRules() {
  return db.select().from(permissionRules).orderBy(desc(permissionRules.createdAt));
}

export async function getResourceAclsList() {
  return db.select().from(resourceAcls).orderBy(desc(resourceAcls.createdAt));
}

export async function getPermissionRuleStats() {
  // Consolidated into parallel queries for performance
  const [[totalRules], [totalAcls], [ruleBreakdown]] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(permissionRules),
    db.select({ count: sql<number>`count(*)` }).from(resourceAcls),
    db.select({
      active: sql<number>`sum(case when active = 1 then 1 else 0 end)`,
      deny: sql<number>`sum(case when effect = 'deny' then 1 else 0 end)`,
    }).from(permissionRules),
  ]);

  return {
    totalRules: totalRules?.count ?? 0,
    activeRules: ruleBreakdown?.active ?? 0,
    totalAcls: totalAcls?.count ?? 0,
    denyRules: ruleBreakdown?.deny ?? 0,
  };
}

export async function getUsersForSelect() {
  return db
    .select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, role: users.role })
    .from(users)
    .orderBy(users.email);
}
