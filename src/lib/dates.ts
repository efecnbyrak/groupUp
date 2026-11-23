/** Tarih gösterimi: DB'de UTC, ekranda her zaman Europe/Istanbul (CLAUDE.md §6). Saf. */
export const DISPLAY_TIME_ZONE = "Europe/Istanbul";

const intlLocale = (locale: string) => (locale === "en" ? "en-GB" : "tr-TR");

export function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeZone: DISPLAY_TIME_ZONE }).format(date);
}

export function formatDateTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short", timeZone: DISPLAY_TIME_ZONE }).format(date);
}
