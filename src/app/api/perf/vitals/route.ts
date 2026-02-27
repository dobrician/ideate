/**
 * Web Vitals collection API.
 * Receives Core Web Vitals metrics from the browser and stores them.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** In-memory storage for recent vitals (circular buffer). */
interface VitalEntry {
  name: string;
  value: number;
  rating: string;
  navigationType: string;
  url: string;
  timestamp: number;
}

const MAX_VITALS = 1000;
const vitalsStore: VitalEntry[] = [];

const VALID_NAMES = new Set(["LCP", "FID", "CLS", "INP", "TTFB"]);
const VALID_RATINGS = new Set(["good", "needs-improvement", "poor"]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { metrics, url } = body;

    if (!Array.isArray(metrics) || metrics.length === 0) {
      return NextResponse.json({ error: "Invalid metrics" }, { status: 400 });
    }

    if (metrics.length > 20) {
      return NextResponse.json({ error: "Too many metrics" }, { status: 400 });
    }

    let stored = 0;
    for (const m of metrics) {
      if (!VALID_NAMES.has(m.name)) continue;
      if (typeof m.value !== "number" || !isFinite(m.value)) continue;
      if (m.rating && !VALID_RATINGS.has(m.rating)) continue;

      vitalsStore.push({
        name: m.name,
        value: m.value,
        rating: m.rating ?? "good",
        navigationType: typeof m.navigationType === "string" ? m.navigationType : "navigate",
        url: typeof url === "string" ? url.slice(0, 200) : "/",
        timestamp: Date.now(),
      });

      if (vitalsStore.length > MAX_VITALS) vitalsStore.shift();
      stored++;
    }

    logger.info({ stored, total: metrics.length }, "Web Vitals recorded");
    return NextResponse.json({ stored });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function GET() {
  const now = Date.now();
  const oneHour = 3600_000;
  const recent = vitalsStore.filter((v) => now - v.timestamp < oneHour);

  const summary: Record<string, { avg: number; p75: number; count: number; good: number; poor: number }> = {};

  for (const name of VALID_NAMES) {
    const entries = recent.filter((v) => v.name === name);
    if (entries.length === 0) continue;

    const values = entries.map((e) => e.value).sort((a, b) => a - b);
    const avg = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
    const p75 = values[Math.floor(values.length * 0.75)] ?? 0;

    summary[name] = {
      avg,
      p75,
      count: entries.length,
      good: entries.filter((e) => e.rating === "good").length,
      poor: entries.filter((e) => e.rating === "poor").length,
    };
  }

  return NextResponse.json({
    summary,
    totalEntries: vitalsStore.length,
    recentEntries: recent.length,
  });
}
