import { en } from "./translations/en";
import { ro } from "./translations/ro";

export type Locale = "en" | "ro";

export const supportedLocales: Locale[] = ["en", "ro"];

const defaultLocaleEnv =
  (process.env.LOCALE || "en").toLowerCase().startsWith("ro") ? "ro" : "en";

const translations: Record<Locale, Record<string, string>> = { en, ro };

/**
 * Translate a key with optional variable interpolation
 */
export function t(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>
): string {
  const table = translations[locale] || translations.en;
  const phrase = table[key] || translations.en[key] || key;
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
