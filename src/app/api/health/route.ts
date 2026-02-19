import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import { resolve, dirname } from "path";
import { mkdirSync } from "fs";
import { checkRedisHealth } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbPath = process.env.DATABASE_URL ?? resolve("data/ideate.db");
  let dbStatus = "ok";

  try {
    mkdirSync(dirname(dbPath), { recursive: true });
    const sqlite = new Database(dbPath);
    sqlite.pragma("quick_check");
    sqlite.close();
  } catch {
    dbStatus = "error";
  }

  const redisStatus = await checkRedisHealth();

  // Healthy if DB is ok; Redis being disabled/errored only degrades (it's optional)
  const status =
    dbStatus === "error"
      ? "degraded"
      : redisStatus === "error"
        ? "degraded"
        : "healthy";

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      database: dbStatus,
      redis: redisStatus,
      version: process.env.npm_package_version ?? "0.1.0",
    },
    { status: status === "healthy" ? 200 : 503 },
  );
}
