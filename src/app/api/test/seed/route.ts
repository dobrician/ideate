import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, projects, proposals, votes } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { resetRateLimits } from "@/lib/rate-limit";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const E2E_TEST_SECRET = process.env.E2E_TEST_SECRET;

/**
 * POST /api/test/seed
 * Creates a verified test user + project + proposal for E2E tests.
 * Gated by E2E_TEST_SECRET env var — returns 404 if not set.
 */
export async function POST(request: NextRequest) {
  if (!E2E_TEST_SECRET) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  if (body.secret !== E2E_TEST_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const role = body.role || "admin";
  const emailSuffix = role === "admin" ? "" : `-${role}`;
  const email = `e2e-test${emailSuffix}@ideate.local`;
  const password = "TestPass123";
  const passwordHash = await hashPassword(password);

  // Upsert test user (verified)
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let userId: string;
  if (existing.length > 0) {
    userId = existing[0].id;
    await db
      .update(users)
      .set({ passwordHash, emailVerified: true, role })
      .where(eq(users.id, userId));
  } else {
    userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      email,
      passwordHash,
      emailVerified: true,
      role,
    });
  }

  // Create test project (deadline 30 days from now)
  const projectId = randomUUID();
  const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(projects).values({
    id: projectId,
    title: `E2E Test Project ${Date.now()}`,
    description: "A project created for automated E2E testing",
    deadline,
    status: "active",
    userId,
  });

  // Create test proposal with a vote
  const proposalId = randomUUID();
  await db.insert(proposals).values({
    id: proposalId,
    projectId,
    title: "Initial Test Proposal",
    description: "A proposal seeded for E2E testing",
    summary: "Test proposal for automated E2E tests",
    userId,
  });

  await db.insert(votes).values({
    proposalId,
    userId,
    value: 1,
  });

  // Reset rate limits so parallel test runs don't block each other
  resetRateLimits();

  return NextResponse.json({
    email,
    password,
    userId,
    projectId,
    proposalId,
  });
}
