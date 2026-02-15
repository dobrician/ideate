import { redirect } from "next/navigation";
import { db } from "@/db";
import { projects, proposals } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ProfileForm } from "./profile-form";

/**
 * User profile page showing user info, their projects and proposals
 */
export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Fetch user's projects
  const userProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, user.id))
    .orderBy(desc(projects.createdAt))
    .limit(10);

  // Fetch user's proposals
  const userProposals = await db
    .select({
      id: proposals.id,
      title: proposals.title,
      projectId: proposals.projectId,
      createdAt: proposals.createdAt,
    })
    .from(proposals)
    .where(eq(proposals.userId, user.id))
    .orderBy(desc(proposals.createdAt))
    .limit(10);

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Unknown";

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Profile</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Email</p>
                <p>{user.email}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Role</p>
                <p className="capitalize">{user.role}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Member Since</p>
                <p>{memberSince}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Display Name</p>
                <p>{displayName}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <ProfileForm
          firstName={user.firstName ?? ""}
          lastName={user.lastName ?? ""}
        />

        <Card>
          <CardHeader>
            <CardTitle>Your Projects ({userProjects.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {userProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects yet.</p>
            ) : (
              <ul className="space-y-2">
                {userProjects.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {p.title}
                    </Link>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {p.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your Proposals ({userProposals.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {userProposals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No proposals yet.</p>
            ) : (
              <ul className="space-y-2">
                {userProposals.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.projectId}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
