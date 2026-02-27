import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("Bundle optimization configuration", () => {
  const configPath = resolve("next.config.ts");
  const content = readFileSync(configPath, "utf-8");

  const requiredOptimized = [
    "lucide-react",
    "recharts",
    "sonner",
    "react-markdown",
    "zod",
  ];

  it("should have optimizePackageImports configured", () => {
    expect(content).toContain("optimizePackageImports");
  });

  for (const pkg of requiredOptimized) {
    it(`should include ${pkg} in optimizePackageImports`, () => {
      expect(content).toContain(`"${pkg}"`);
    });
  }

  it("should have standalone output mode", () => {
    expect(content).toContain('output: "standalone"');
  });

  it("should have server external packages for Node-only deps", () => {
    expect(content).toContain("serverExternalPackages");
    expect(content).toContain("better-sqlite3");
    expect(content).toContain("ioredis");
    expect(content).toContain("pg");
  });

  it("should have bundle analyzer available", () => {
    expect(content).toContain("@next/bundle-analyzer");
    expect(content).toContain('ANALYZE');
  });

  it("should have cache headers for static assets", () => {
    expect(content).toContain("immutable");
    expect(content).toContain("max-age=31536000");
  });
});
