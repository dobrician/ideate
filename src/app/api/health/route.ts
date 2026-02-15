import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import { resolve, dirname } from "path";
import { mkdirSync } from "fs";

export const dynamic = "force-dynamic";

export function GET() {
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

  const status = dbStatus === "ok" ? "healthy" : "degraded";

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      database: dbStatus,
      version: process.env.npm_package_version ?? "0.1.0",
    },
    { status: status === "healthy" ? 200 : 503 }
  );
}
