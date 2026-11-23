/**
 * Etkinlik kuralları (EVENTS-FORMS-I18N §2–3, §8) — saf TS, unit test edilir.
 */
import { docToPlainText, isDocEmpty, type RichDoc } from "@/lib/rich-text/doc";

export const EVENT_TITLE_MAX = 120;
export const EVENT_SUMMARY_MAX = 280;
export const EVENT_DESCRIPTION_MAX = 20_000;
export const EVENT_GALLERY_MAX = 8;
export const TEAM_SIZE_MAX = 50;
export const CAPACITY_MAX = 100_000;
/** "Son 2 gün" eşiği (§2 CLOSING_SOON ≤ 48 saat). */
export const CLOSING_SOON_MS = 48 * 3600_000;

export type RegistrationState = "NOT_OPEN" | "OPEN" | "CLOSING_SOON" | "FULL" | "WAITLIST" | "CLOSED";

export interface RegistrationWindow {
  status: string;
  applyOpensAt: Date | null;
  applyClosesAt: Date | null;
  capacity: number | null;
  waitlistEnabled: boolean;
}

/** Türetilmiş başvuru durumu (§2). `taken`: kontenjanı dolduran başvuru/takım sayısı (F7). */
export function registrationState(e: RegistrationWindow, now: Date, taken = 0): RegistrationState {
  if (e.status !== "PUBLISHED" || !e.applyOpensAt || !e.applyClosesAt) return "CLOSED";
  if (now < e.applyOpensAt) return "NOT_OPEN";
  if (now >= e.applyClosesAt) return "CLOSED";
  if (e.capacity !== null && taken >= e.capacity) return e.waitlistEnabled ? "WAITLIST" : "FULL";
  return e.applyClosesAt.getTime() - now.getTime() <= CLOSING_SOON_MS ? "CLOSING_SOON" : "OPEN";
}

export function isRegistrationOpen(state: RegistrationState): boolean {
  return state === "OPEN" || state === "CLOSING_SOON" || state === "WAITLIST";
}

/** Geri sayım parçaları ("2 gün 4 saat"); süre geçtiyse null. */
export function countdown(to: Date, now: Date): { days: number; hours: number; minutes: number } | null {
  const ms = to.getTime() - now.getTime();
  if (ms <= 0) return null;
  const minutes = Math.floor(ms / 60_000);
  return { days: Math.floor(minutes / 1440), hours: Math.floor((minutes % 1440) / 60), minutes: minutes % 60 };
}

/** §7.2 gösterim: locale=en ve EN varsa EN, yoksa TR. */
export function pick<T>(locale: string, tr: T, en: T | null | undefined): T {
  return locale === "en" && en !== null && en !== undefined && en !== "" ? en : tr;
}

export interface SubmittableEvent {
  categoryIsLeaf: boolean;
  titleTr: string;
  summaryTr: string;
  descriptionTr: RichDoc;
  coverKey: string | null;
  isOnline: boolean;
  locationName: string | null;
  onlineUrl: string | null;
  startAt: Date | null;
  endAt: Date | null;
  applyOpensAt: Date | null;
  applyClosesAt: Date | null;
  capacity: number | null;
  mode: "INDIVIDUAL" | "TEAM";
  teamMinSize: number | null;
  teamMaxSize: number | null;
}

/**
 * Onaya göndermeden önce eksik/çelişkili alanlar → { alan: mesaj anahtarı }. Boş nesne = gönderilebilir.
 */
export function submitProblems(e: SubmittableEvent, now: Date): Record<string, string> {
  const p: Record<string, string> = {};
  if (!e.categoryIsLeaf) p.categoryId = "event.errors.categoryLeaf";
  if (!e.titleTr.trim()) p.titleTr = "validation.required";
  if (!e.summaryTr.trim()) p.summaryTr = "validation.required";
  if (isDocEmpty(e.descriptionTr)) p.descriptionTr = "validation.required";
  else if (docToPlainText(e.descriptionTr).length > EVENT_DESCRIPTION_MAX) p.descriptionTr = "validation.tooLong";
  if (!e.coverKey) p.coverKey = "event.errors.coverRequired";
  if (e.isOnline ? !e.onlineUrl : !e.locationName?.trim()) p[e.isOnline ? "onlineUrl" : "locationName"] = "validation.required";
  for (const k of ["startAt", "endAt", "applyOpensAt", "applyClosesAt"] as const) if (!e[k]) p[k] = "validation.required";
  if (e.startAt && e.endAt && e.endAt <= e.startAt) p.endAt = "event.errors.endBeforeStart";
  if (e.applyOpensAt && e.applyClosesAt && e.applyClosesAt <= e.applyOpensAt) p.applyClosesAt = "event.errors.closeBeforeOpen";
  if (e.applyClosesAt && e.endAt && e.applyClosesAt > e.endAt) p.applyClosesAt = "event.errors.closeAfterEnd";
  if (e.endAt && e.endAt <= now) p.endAt = "event.errors.inPast";
  if (e.capacity !== null && (e.capacity < 1 || e.capacity > CAPACITY_MAX)) p.capacity = "validation.number";
  if (e.mode === "TEAM") {
    const min = e.teamMinSize ?? 0;
    const max = e.teamMaxSize ?? 0;
    if (min < 1 || min > TEAM_SIZE_MAX) p.teamMinSize = "validation.number";
    if (max < 1 || max > TEAM_SIZE_MAX) p.teamMaxSize = "validation.number";
    else if (max < min) p.teamMaxSize = "event.errors.teamRange";
  }
  return p;
}

/** Kapak ve galeri görsellerinin 400px varyant anahtarı (kart için): "a/b.webp" → "a/b-400.webp". */
export function variantKey(key: string, width: 400): string {
  return key.replace(/\.webp$/, `-${width}.webp`);
}
