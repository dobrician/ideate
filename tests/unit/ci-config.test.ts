import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * CI pipeline configuration tests.
 * Validates the CI YAML structure via string matching (no yaml parser needed).
 */
describe("CI pipeline configuration", () => {
  const ciPath = resolve(".github/workflows/ci.yml");
  const content = readFileSync(ciPath, "utf-8");

  it("should have all 7 jobs defined", () => {
    const jobs = ["lint:", "typecheck:", "test:", "build:", "smoke-tests:", "e2e-tests:", "docker-push:"];
    for (const job of jobs) {
      expect(content).toContain(job);
    }
  });

  it("build job should upload nextjs-build artifact", () => {
    expect(content).toContain("actions/upload-artifact@v4");
    expect(content).toContain("name: nextjs-build");
  });

  it("smoke-tests should download build artifact", () => {
    // Find the smoke-tests section and check for download-artifact
    const smokeSection = content.split("smoke-tests:")[1]?.split(/\n  \w+-?\w*:/)[0] ?? "";
    expect(smokeSection).toContain("actions/download-artifact@v4");
    expect(smokeSection).toContain("name: nextjs-build");
  });

  it("e2e-tests should download build artifact", () => {
    const e2eSection = content.split("e2e-tests:")[1]?.split(/\n  \w+-?\w*:/)[0] ?? "";
    expect(e2eSection).toContain("actions/download-artifact@v4");
    expect(e2eSection).toContain("name: nextjs-build");
  });

  it("smoke-tests should NOT contain a Build app step", () => {
    const smokeSection = content.split("smoke-tests:")[1]?.split(/\n  \w+-?\w*:/)[0] ?? "";
    expect(smokeSection).not.toContain("name: Build app");
    expect(smokeSection).not.toContain("npm run build");
  });

  it("e2e-tests should NOT contain a Build app step", () => {
    const e2eSection = content.split("e2e-tests:")[1]?.split(/\n  \w+-?\w*:/)[0] ?? "";
    expect(e2eSection).not.toContain("name: Build app");
    expect(e2eSection).not.toContain("npm run build");
  });

  it("should cache Playwright browsers in smoke-tests and e2e-tests", () => {
    const smokeSection = content.split("smoke-tests:")[1]?.split(/\n  \w+-?\w*:/)[0] ?? "";
    const e2eSection = content.split("e2e-tests:")[1]?.split(/\n  \w+-?\w*:/)[0] ?? "";
    expect(smokeSection).toContain("actions/cache@v4");
    expect(smokeSection).toContain("playwright");
    expect(e2eSection).toContain("actions/cache@v4");
    expect(e2eSection).toContain("playwright");
  });

  it("docker-push should depend on both smoke-tests and e2e-tests", () => {
    const dockerSection = content.split("docker-push:")[1] ?? "";
    expect(dockerSection).toContain("smoke-tests");
    expect(dockerSection).toContain("e2e-tests");
  });

  it("docker-push should only run on main push", () => {
    const dockerSection = content.split("docker-push:")[1] ?? "";
    expect(dockerSection).toContain("push");
    expect(dockerSection).toContain("refs/heads/main");
  });

  it("build should depend on lint, typecheck, test", () => {
    const buildSection = content.split(/\n  build:/)[1]?.split(/\n  \w+-?\w*:/)[0] ?? "";
    expect(buildSection).toContain("lint");
    expect(buildSection).toContain("typecheck");
    expect(buildSection).toContain("test");
  });

  it("should use top-level env for shared variables", () => {
    // Check env block before jobs
    const envSection = content.split("jobs:")[0];
    expect(envSection).toContain("DATABASE_URL:");
    expect(envSection).toContain("JWT_SECRET:");
  });

  it("should not have continue-on-error anywhere", () => {
    expect(content).not.toContain("continue-on-error");
  });

  it("should conditionally install Playwright deps when cache hits", () => {
    expect(content).toContain("install-deps chromium");
  });

  it("build job should report build duration via GitHub notice", () => {
    const buildSection = content.split(/\n  build:/)[1]?.split(/\n  \w+-?\w*:/)[0] ?? "";
    expect(buildSection).toContain("::notice title=Build Duration::");
  });

  it("build job should report build size via GitHub notice", () => {
    const buildSection = content.split(/\n  build:/)[1]?.split(/\n  \w+-?\w*:/)[0] ?? "";
    expect(buildSection).toContain("::notice title=Build Size::");
  });

  it("build artifact should use tar to avoid filename character issues", () => {
    const buildSection = content.split(/\n  build:/)[1]?.split(/\n  \w+-?\w*:/)[0] ?? "";
    expect(buildSection).toContain("tar cf");
    expect(buildSection).toContain("nextjs-build.tar");
  });

  it("smoke and e2e jobs should extract tar artifact", () => {
    const smokeSection = content.split("smoke-tests:")[1]?.split(/\n  \w+-?\w*:/)[0] ?? "";
    const e2eSection = content.split("e2e-tests:")[1]?.split(/\n  \w+-?\w*:/)[0] ?? "";
    expect(smokeSection).toContain("tar xf nextjs-build.tar");
    expect(e2eSection).toContain("tar xf nextjs-build.tar");
  });
});
