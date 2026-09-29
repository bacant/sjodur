import { createI18n } from "vue-i18n";
import messages from "../locales";

export const supportedLocales = ["de", "en"] as const;
export type Locale = (typeof supportedLocales)[number];
export const defaultLocale: Locale = "de";

/** Locale tag used for Intl formatting (numbers, dates). */
export const intlLocale: Record<Locale, string> = { de: "de-DE", en: "en-IE" };

export function createAppI18n(locale: Locale = defaultLocale) {
  return createI18n({
    legacy: false,
    locale,
    fallbackLocale: "en",
    messages,
  });
}
