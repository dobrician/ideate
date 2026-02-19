#!/usr/bin/env npx tsx
/**
 * CLI script to seed the database with realistic demo data.
 * Usage: npx tsx scripts/seed-demo.ts [--no-clean]
 */

import { seedDemoData } from "../src/lib/factories/seed";

const noClean = process.argv.includes("--no-clean");

async function main() {
  console.log("Seeding demo data...");
  if (!noClean) {
    console.log("Cleaning existing data first (pass --no-clean to skip)");
  }

  const result = await seedDemoData(!noClean);

  console.log("\nDemo data seeded successfully:");
  console.log(`  Users:         ${result.users}`);
  console.log(`  Projects:      ${result.projects}`);
  console.log(`  Proposals:     ${result.proposals}`);
  console.log(`  Votes:         ${result.votes}`);
  console.log(`  Comments:      ${result.comments}`);
  console.log(`  Tags:          ${result.tags}`);
  console.log(`  Project tags:  ${result.projectTags}`);
  console.log(`  Proposal tags: ${result.proposalTags}`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
