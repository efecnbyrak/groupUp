/**
 * Ticket durum kuralları (APPROVALS-TICKETS §7) — saf TS.
 * OPEN → (karşı taraf yanıtlar) ANSWERED → (talep eden yazar) OPEN … → CLOSED;
 * her iki taraf kapatabilir; kapalı ticket 7 gün içinde yeniden açılabilir.
 */
export type TicketStatusName = "OPEN" | "ANSWERED" | "CLOSED";
export type TicketSide = "requester" | "responder";

export const REOPEN_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Mesaj sonrası durum; kapalı ticket'a mesaj yazılamaz (null). */
export function statusAfterMessage(current: TicketStatusName, side: TicketSide): TicketStatusName | null {
  if (current === "CLOSED") return null;
  return side === "requester" ? "OPEN" : "ANSWERED";
}

export function canClose(current: TicketStatusName): boolean {
  return current !== "CLOSED";
}

export function canReopen(current: TicketStatusName, closedAt: Date | null, now: Date): boolean {
  if (current !== "CLOSED" || !closedAt) return false;
  return now.getTime() - closedAt.getTime() <= REOPEN_WINDOW_DAYS * DAY_MS;
}
