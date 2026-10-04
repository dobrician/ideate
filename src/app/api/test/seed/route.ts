import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, projects, proposals, votes } from "@/db/schema";
import { createSessionToken } from "@/lib/auth";
import { getE2EConfig } from "@/lib/e2e-config";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { resetRateLimits } from "@/lib/rate-limit";
import { randomUUID } from "crypto";


/**
 * POST /api/test/seed
 * Creates a verified test user + project + proposal for E2E tests.
 * Requires explicit E2E opt-in, secret and loopback APP_URL; unavailable publicly.
 */
export async function POST(request: NextRequest) {
  const config = getE2EConfig();
  if (!config) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
  const parsed = z.object({ secret: z.string(), role: z.enum(["admin", "manager", "member", "viewer"]).default("admin") }).safeParse(await request.json());
  if (!parsed.success || parsed.data.secret !== config.secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const role = parsed.data.role;
  const uniqueId = randomUUID().slice(0, 8);
  const email = `e2e-${uniqueId}@ideate.local`;

  const userId = randomUUID();
  await db.insert(users).values({
    id: userId,
    email,
    emailVerified: true,
    role,
    onboardingCompleted: true,
  });

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
    userId,
    projectId,
    proposalId,
    cookies: [
      { name: "session", value: createSessionToken(userId, email), httpOnly: true },
      { name: "csrf_token", value: randomUUID(), httpOnly: false },
    ].map(cookie => ({ ...cookie, domain: config.origin.hostname, path: "/", secure: config.origin.protocol === "https:", sameSite: "Lax", expires: Math.floor(Date.now() / 1000) + 7 * 86400 })),
  });
  } catch (error) {
    logger.error({ err: error }, "Isolated test fixture failed");
    return NextResponse.json({ error: "Test fixture failed" }, { status: 500 });
  }
}
