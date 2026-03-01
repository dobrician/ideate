import type { MetadataRoute } from "next";
import { db } from "@/db";
import { projects } from "@/db/schema";

export const dynamic = "force-dynamic";

const APP_URL = process.env.APP_URL || "https://idea.surmont.co";

/**
 * Dynamic sitemap listing all public pages and projects
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const allProjects = await db
    .select({ id: projects.id, updatedAt: projects.updatedAt })
    .from(projects);

  const projectEntries: MetadataRoute.Sitemap = allProjects.map((p) => ({
    url: `${APP_URL}/projects/${p.id}`,
    lastModified: p.updatedAt || new Date(),
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  return [
    {
      url: APP_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${APP_URL}/projects`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${APP_URL}/dashboard`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.6,
    },
    ...projectEntries,
  ];
}
