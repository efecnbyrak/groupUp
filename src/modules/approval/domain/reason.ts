/** Ret gerekçesi kuralı (kullanıcı kararı 2026-11-23): trim, 10–500 karakter. Saf TS. */
export const REJECT_REASON_MIN = 10;
export const REJECT_REASON_MAX = 500;
/** Talep gerekçesi (üye çıkarma/engelleme: zorunlu) — aynı üst sınır. */
export const REQUEST_REASON_MAX = 500;

export type ReasonIssue = "required" | "tooShort" | "tooLong";

export function checkRejectReason(input: string): ReasonIssue | null {
  const value = input.trim();
  if (value.length === 0) return "required";
  if (value.length < REJECT_REASON_MIN) return "tooShort";
  if (value.length > REJECT_REASON_MAX) return "tooLong";
  return null;
}
