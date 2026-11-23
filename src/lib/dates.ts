/** Tarih gösterimi: DB'de UTC, ekranda her zaman Europe/Istanbul (CLAUDE.md §6). Saf. */
export const DISPLAY_TIME_ZONE = "Europe/Istanbul";

const intlLocale = (locale: string) => (locale === "en" ? "en-GB" : "tr-TR");

export function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeZone: DISPLAY_TIME_ZONE }).format(date);
}

export function formatDateTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short", timeZone: DISPLAY_TIME_ZONE }).format(date);
}

/** Gün adıyla tarih-saat: "Cmt 29 Kas 2026 14:00" (etkinlik kartı §8). */
export function formatEventDateTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: DISPLAY_TIME_ZONE }).format(date);
}

/** `<input type="datetime-local">` değeri (İstanbul saatiyle) — "YYYY-MM-DDTHH:mm". */
export function toIstanbulLocalInput(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: DISPLAY_TIME_ZONE })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** İstanbul yerel "YYYY-MM-DDTHH:mm" → UTC Date (Türkiye 2016'dan beri sabit UTC+3, yaz saati yok). */
export function fromIstanbulLocalInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
