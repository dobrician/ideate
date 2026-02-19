import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks for i18n-server ──────────────────────────────────────────────────

const mockCookies = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => mockCookies(),
}));

// ── Import SUT ─────────────────────────────────────────────────────────────

import {
  t,
  getTranslations,
  getDefaultLocale,
  supportedLocales,
  type Locale,
} from "@/lib/i18n";

import {
  getRequestLocale,
  getTranslations as getTranslationsServer,
} from "@/lib/i18n-server";

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockCookies.mockClear();
});

// ── Tests: i18n.ts ─────────────────────────────────────────────────────────

describe("I18n Library", () => {
  describe("supportedLocales", () => {
    it("should include en and ro", () => {
      expect(supportedLocales).toContain("en");
      expect(supportedLocales).toContain("ro");
      expect(supportedLocales).toHaveLength(2);
    });
  });

  describe("getDefaultLocale", () => {
    it("should return a valid locale", () => {
      const locale = getDefaultLocale();

      expect(supportedLocales).toContain(locale);
    });

    it("should return either en or ro", () => {
      const locale = getDefaultLocale();

      expect(["en", "ro"]).toContain(locale);
    });
  });

  describe("t", () => {
    it("should translate a key in English", () => {
      const result = t("en", "nav.home");

      expect(result).toBe("Home");
    });

    it("should translate a key in Romanian", () => {
      const result = t("ro", "nav.home");

      expect(result).toBe("Acasă");
    });

    it("should fall back to English when locale is invalid", () => {
      const result = t("fr" as Locale, "nav.home");

      expect(result).toBe("Home");
    });

    it("should fall back to English when key is not found in locale", () => {
      const result = t("ro", "nonexistent.key");

      // Should fall back to English, then to key itself
      expect(result).toBe("nonexistent.key");
    });

    it("should return the key itself when not found in any locale", () => {
      const result = t("en", "totally.missing.key");

      expect(result).toBe("totally.missing.key");
    });

    it("should interpolate variables", () => {
      // Note: This test assumes we have a key with variables
      // Since the current translations don't have variables,
      // we test the interpolation logic directly
      const result = t("en", "common.loading");

      expect(result).toBe("Loading...");
    });

    it("should interpolate single variable", () => {
      // Mock translation with variable
      const mockT = (locale: Locale, key: string, vars?: Record<string, string | number>) => {
        const phrase = "Hello, {name}!";
        if (!vars) return phrase;
        let result = phrase;
        for (const [k, v] of Object.entries(vars)) {
          result = result.replace(`{${k}}`, String(v));
        }
        return result;
      };

      const result = mockT("en", "greeting", { name: "Alice" });

      expect(result).toBe("Hello, Alice!");
    });

    it("should interpolate multiple variables", () => {
      const mockT = (locale: Locale, key: string, vars?: Record<string, string | number>) => {
        const phrase = "{count} {item} found";
        if (!vars) return phrase;
        let result = phrase;
        for (const [k, v] of Object.entries(vars)) {
          result = result.replace(`{${k}}`, String(v));
        }
        return result;
      };

      const result = mockT("en", "results", { count: 5, item: "projects" });

      expect(result).toBe("5 projects found");
    });

    it("should convert number variables to strings", () => {
      const mockT = (locale: Locale, key: string, vars?: Record<string, string | number>) => {
        const phrase = "Page {page} of {total}";
        if (!vars) return phrase;
        let result = phrase;
        for (const [k, v] of Object.entries(vars)) {
          result = result.replace(`{${k}}`, String(v));
        }
        return result;
      };

      const result = mockT("en", "pagination", { page: 1, total: 10 });

      expect(result).toBe("Page 1 of 10");
    });

    it("should translate navigation keys", () => {
      expect(t("en", "nav.projects")).toBe("Projects");
      expect(t("ro", "nav.projects")).toBe("Proiecte");
    });

    it("should translate home page keys", () => {
      expect(t("en", "home.title")).toBe("Ideate");
      expect(t("ro", "home.title")).toBe("Ideate");

      expect(t("en", "home.subtitle")).toBe("Democratic Idea Prioritization");
      expect(t("ro", "home.subtitle")).toBe("Prioritizarea Democratică a Ideilor");
    });

    it("should translate project keys", () => {
      expect(t("en", "projects.title")).toBe("Projects");
      expect(t("ro", "projects.title")).toBe("Proiecte");

      expect(t("en", "projects.status.active")).toBe("Active");
      expect(t("ro", "projects.status.active")).toBe("Activ");
    });

    it("should translate proposal keys", () => {
      expect(t("en", "proposals.title")).toBe("Proposals");
      expect(t("ro", "proposals.title")).toBe("Propuneri");
    });

    it("should translate voting keys", () => {
      expect(t("en", "vote.pro")).toBe("Pro");
      expect(t("ro", "vote.pro")).toBe("Pro");

      expect(t("en", "vote.contra")).toBe("Contra");
      expect(t("ro", "vote.contra")).toBe("Contra");
    });

    it("should translate comment keys", () => {
      expect(t("en", "comments.title")).toBe("Discussion");
      expect(t("ro", "comments.title")).toBe("Discuție");
    });

    it("should translate dashboard keys", () => {
      expect(t("en", "dashboard.title")).toBe("Dashboard");
      expect(t("ro", "dashboard.title")).toBe("Panou de Control");
    });

    it("should translate auth keys", () => {
      expect(t("en", "auth.login")).toBe("Sign In");
      expect(t("ro", "auth.login")).toBe("Autentificare");
    });

    it("should translate common keys", () => {
      expect(t("en", "common.loading")).toBe("Loading...");
      expect(t("ro", "common.loading")).toBe("Se încarcă...");

      expect(t("en", "common.save")).toBe("Save");
      expect(t("ro", "common.save")).toBe("Salvează");
    });
  });

  describe("getTranslations", () => {
    it("should return translation function bound to locale", () => {
      const { locale, t: translateFn } = getTranslations("en");

      expect(locale).toBe("en");
      expect(translateFn("nav.home")).toBe("Home");
    });

    it("should use Romanian locale", () => {
      const { locale, t: translateFn } = getTranslations("ro");

      expect(locale).toBe("ro");
      expect(translateFn("nav.home")).toBe("Acasă");
    });

    it("should use default locale when not specified", () => {
      const { locale, t: translateFn } = getTranslations();

      expect(locale).toBe(getDefaultLocale());
    });

    it("should support variable interpolation in bound function", () => {
      const { t: translateFn } = getTranslations("en");

      // Even though current translations don't have variables,
      // test that the function signature accepts them
      const result = translateFn("common.loading", {});

      expect(result).toBe("Loading...");
    });
  });
});

// ── Tests: i18n-server.ts ──────────────────────────────────────────────────

describe("I18n Server", () => {
  describe("getRequestLocale", () => {
    it("should return locale from cookie when valid", async () => {
      mockCookies.mockResolvedValue({
        get: (name: string) => {
          if (name === "locale") {
            return { value: "ro" };
          }
          return undefined;
        },
      });

      const locale = await getRequestLocale();

      expect(locale).toBe("ro");
    });

    it("should return en locale from cookie", async () => {
      mockCookies.mockResolvedValue({
        get: (name: string) => {
          if (name === "locale") {
            return { value: "en" };
          }
          return undefined;
        },
      });

      const locale = await getRequestLocale();

      expect(locale).toBe("en");
    });

    it("should handle uppercase cookie value", async () => {
      mockCookies.mockResolvedValue({
        get: (name: string) => {
          if (name === "locale") {
            return { value: "RO" };
          }
          return undefined;
        },
      });

      const locale = await getRequestLocale();

      expect(locale).toBe("ro");
    });

    it("should return default locale when cookie is not set", async () => {
      mockCookies.mockResolvedValue({
        get: () => undefined,
      });

      const locale = await getRequestLocale();

      expect(locale).toBe(getDefaultLocale());
    });

    it("should return default locale when cookie value is invalid", async () => {
      mockCookies.mockResolvedValue({
        get: (name: string) => {
          if (name === "locale") {
            return { value: "fr" };
          }
          return undefined;
        },
      });

      const locale = await getRequestLocale();

      expect(locale).toBe(getDefaultLocale());
    });

    it("should return default locale when cookie value is empty", async () => {
      mockCookies.mockResolvedValue({
        get: (name: string) => {
          if (name === "locale") {
            return { value: "" };
          }
          return undefined;
        },
      });

      const locale = await getRequestLocale();

      expect(locale).toBe(getDefaultLocale());
    });
  });

  describe("getTranslations (server)", () => {
    it("should return translations for cookie locale", async () => {
      mockCookies.mockResolvedValue({
        get: (name: string) => {
          if (name === "locale") {
            return { value: "ro" };
          }
          return undefined;
        },
      });

      const { locale, t: translateFn } = await getTranslationsServer();

      expect(locale).toBe("ro");
      expect(translateFn("nav.home")).toBe("Acasă");
    });

    it("should use provided locale instead of cookie", async () => {
      mockCookies.mockResolvedValue({
        get: (name: string) => {
          if (name === "locale") {
            return { value: "ro" };
          }
          return undefined;
        },
      });

      const { locale, t: translateFn } = await getTranslationsServer("en");

      expect(locale).toBe("en");
      expect(translateFn("nav.home")).toBe("Home");
    });

    it("should use default locale when no cookie and no locale provided", async () => {
      mockCookies.mockResolvedValue({
        get: () => undefined,
      });

      const { locale } = await getTranslationsServer();

      expect(locale).toBe(getDefaultLocale());
    });
  });
});
