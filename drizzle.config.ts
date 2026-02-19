import { defineConfig } from "drizzle-kit";

const driver = process.env.DATABASE_DRIVER ?? "sqlite";

export default defineConfig(
  driver === "postgresql"
    ? {
        schema: "./src/db/schema-pg.ts",
        out: "./drizzle-pg",
        dialect: "postgresql",
        dbCredentials: {
          url: process.env.POSTGRESQL_URL ?? process.env.DATABASE_URL ?? "postgresql://localhost:5432/ideate",
        },
      }
    : {
        schema: "./src/db/schema.ts",
        out: "./drizzle",
        dialect: "sqlite",
        dbCredentials: {
          url: process.env.DATABASE_URL ?? "data/ideate.db",
        },
      },
);
