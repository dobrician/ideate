import { afterEach, describe, expect, it, vi } from "vitest";
import { getE2EConfig } from "@/lib/e2e-config";

afterEach(() => vi.unstubAllEnvs());
describe("E2EConfig", () => {
  it("should disable fixtures unless explicitly enabled", () => {
    vi.stubEnv("E2E_TEST_ENABLED", "false");
    vi.stubEnv("E2E_TEST_SECRET", "fixture-secret");
    vi.stubEnv("APP_URL", "http://localhost:4110");
    expect(getE2EConfig()).toBeNull();
  });
  it.each(["https://ideate.surcod.ro", "https://test.ideate.surcod.ro", "invalid", "http://localhost.example.com"])("should reject fixtures on %s", origin => {
    vi.stubEnv("E2E_TEST_ENABLED", "true");
    vi.stubEnv("E2E_TEST_SECRET", "fixture-secret");
    vi.stubEnv("APP_URL", origin);
    expect(getE2EConfig()).toBeNull();
  });
  it("should require a secret even on loopback", () => {
    vi.stubEnv("E2E_TEST_ENABLED", "true");
    vi.stubEnv("E2E_TEST_SECRET", "");
    vi.stubEnv("APP_URL", "http://localhost:4110");
    expect(getE2EConfig()).toBeNull();
  });
  it.each(["https://localhost:4111", "http://127.0.0.1:4110", "http://[::1]:4110"])("should allow explicitly enabled fixtures on %s", origin => {
    vi.stubEnv("E2E_TEST_ENABLED", "true");
    vi.stubEnv("E2E_TEST_SECRET", "fixture-secret");
    vi.stubEnv("APP_URL", origin);
    expect(getE2EConfig()).toEqual({ secret: "fixture-secret", origin: new URL(origin) });
  });
});
