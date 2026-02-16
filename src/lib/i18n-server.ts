import { cookies } from "next/headers";
import {
  getDefaultLocale,
  supportedLocales,
  type Locale,
  getTranslations as getTranslationsBase,
} from "./i18n";

/**
 * Get the current locale from the request cookie (server-side)
 */
export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("locale")?.value?.toLowerCase();
  if (cookieLocale && supportedLocales.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale;
  }
  return getDefaultLocale();
}

/**
 * Get translations bound to the request locale (server-side)
 */
export async function getTranslations(locale?: Locale) {
  const loc = locale || (await getRequestLocale());
  return getTranslationsBase(loc);
}
