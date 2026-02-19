import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/lib/**/*.ts",
        "src/proxy.ts",
        "src/db/index.ts",
        "src/components/stat-card.tsx",
        "src/app/dashboard/queries.ts",
        "src/app/api/search/route.ts",
        "src/app/api/email/deliverability/route.ts",
        "src/app/profile/actions.ts",
        "src/app/projects/actions.ts",
        "src/app/projects/[id]/proposals/actions.ts",
        "src/lib/queue/index.ts",
        "src/lib/query-explain.ts",
        "src/app/api/cron/jobs/route.ts",
      ],
      exclude: [
        "src/lib/use-*.ts", // React hooks (require DOM environment)
        "src/lib/export.ts", // Pure barrel re-export (no logic to test)
      ],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
