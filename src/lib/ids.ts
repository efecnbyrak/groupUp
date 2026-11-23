import { randomInt } from "node:crypto";

/**
 * Okunabilir kod üretimi (davet kodu, ileride takım kodu). Karışan karakterler yok: 0/O, 1/I/L.
 * Saf modül (yalnızca node:crypto) — unit test edilir.
 */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;

export function randomCode(length = INVITE_CODE_LENGTH, random: (max: number) => number = randomInt): string {
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[random(CODE_ALPHABET.length)];
  return out;
}

/** Kullanıcının yazdığı kodu normalize eder (boşluk/tire atılır, büyük harf). Geçersizse null. */
export function normalizeCode(input: string, length = INVITE_CODE_LENGTH): string | null {
  const code = input.replace(/[\s-]/g, "").toUpperCase();
  if (code.length !== length) return null;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return null;
  return code;
}
