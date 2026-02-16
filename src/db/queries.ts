import { db } from "@/db";
import { comments, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface ProjectComment {
  id: string;
  content: string;
  parentId: string | null;
  userId: string | null;
  userEmail?: string;
  userName?: string;
  createdAt: Date | null;
}

/**
 * Fetch all comments for a project (project-level, not proposal-level).
 * Returns flat list ordered by created_at; caller builds tree.
 */
export async function getProjectComments(
  projectId: string
): Promise<ProjectComment[]> {
  const rows = await db
    .select({
      id: comments.id,
      content: comments.content,
      parentId: comments.parentId,
      userId: comments.userId,
      createdAt: comments.createdAt,
      userEmail: users.email,
      userName: users.firstName,
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.projectId, projectId))
    .orderBy(comments.createdAt);

  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    parentId: r.parentId,
    userId: r.userId,
    userEmail: r.userEmail ?? undefined,
    userName: r.userName ?? undefined,
    createdAt: r.createdAt,
  }));
}
