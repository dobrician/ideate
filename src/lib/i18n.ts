import { en } from "./translations/en";
import { ro } from "./translations/ro";

export type Locale = "en" | "ro";

export const supportedLocales: Locale[] = ["en", "ro"];

const defaultLocaleEnv =
  (process.env.LOCALE || "en").toLowerCase().startsWith("ro") ? "ro" : "en";

const translations: Record<Locale, Record<string, string>> = { en, ro };

/**
 * Translate a key with optional variable interpolation.
 * Supports pluralization via {count} variable: when a key has a
 * companion key ending in "_one", it is used when count === 1.
 * Example: "projects.total" for plural, "projects.total_one" for singular.
 */
export function t(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>
): string {
  const table = translations[locale] || translations.en;

  // Pluralization: if count === 1 and a _one variant exists, use it
  let resolvedKey = key;
  if (vars && "count" in vars && Number(vars.count) === 1) {
    const oneKey = `${key}_one`;
    if (table[oneKey] || translations.en[oneKey]) {
      resolvedKey = oneKey;
    }
  }

  const phrase = table[resolvedKey] || translations.en[resolvedKey] || resolvedKey;
  if (!vars) return phrase;

  let result = phrase;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replace(`{${k}}`, String(v));
  }
  return result;
}

/**
 * Get a translation function bound to a locale
 */
export function getTranslations(locale?: Locale) {
  const loc = locale || defaultLocaleEnv;
  return {
    locale: loc,
    t: (key: string, vars?: Record<string, string | number>) =>
      t(loc, key, vars),
  };
}

/**
 * Get the default locale from environment
 */
export function getDefaultLocale(): Locale {
  return defaultLocaleEnv;
}
