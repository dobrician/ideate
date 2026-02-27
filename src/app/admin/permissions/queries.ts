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
  const [totalRules] = await db.select({ count: sql<number>`count(*)` }).from(permissionRules);
  const [activeRules] = await db
    .select({ count: sql<number>`count(*)` })
    .from(permissionRules)
    .where(eq(permissionRules.active, true));
  const [totalAcls] = await db.select({ count: sql<number>`count(*)` }).from(resourceAcls);
  const [denyRules] = await db
    .select({ count: sql<number>`count(*)` })
    .from(permissionRules)
    .where(eq(permissionRules.effect, "deny"));

  return {
    totalRules: totalRules?.count ?? 0,
    activeRules: activeRules?.count ?? 0,
    totalAcls: totalAcls?.count ?? 0,
    denyRules: denyRules?.count ?? 0,
  };
}

export async function getUsersForSelect() {
  return db
    .select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, role: users.role })
    .from(users)
    .orderBy(users.email);
}
