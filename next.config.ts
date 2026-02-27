import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [],
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "sonner",
      "react-markdown",
      "zod",
    ],
  },
  serverExternalPackages: ["ioredis", "pg", "better-sqlite3"],
  headers: async () => [
    {
      source: "/_next/static/:path*",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
    {
      source: "/icons/:path*",
      headers: [
        { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
      ],
    },
    {
      source: "/manifest.json",
      headers: [
        { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
      ],
    },
  ],
};

const config = withBundleAnalyzer(nextConfig);

// Sentry is optional — only active when SENTRY_DSN is set
export default withSentryConfig(config, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
