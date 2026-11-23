/**
 * Şifre politikası — docs/AUTH-EMAIL.md §5. Saf fonksiyon: hem sunucu (zod) hem
 * istemci (canlı kural listesi) kullanır. Minimumu 8'e çıkarmak: PASSWORD_MIN.
 */
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 64;
export const PASSWORD_SYMBOLS = "!@#$%^&*()-_=+.,?:[]{}~";

export type PasswordRule =
  | "length"
  | "letter"
  | "symbol"
  | "allowedChars"
  | "noPersonalInfo";

export interface PasswordContext {
  email?: string;
  firstName?: string;
  lastName?: string;
}

const LETTER = /\p{L}/u;
const ALLOWED_LETTERS = /^[a-zA-ZçğıöşüÇĞİÖŞÜ]$/u;
// Kişisel bilgi eşleşmesi kısa parçalarda yanlış pozitif üretmesin.
const MIN_PERSONAL_PART = 3;

const normalize = (value: string) => value.toLocaleLowerCase("tr-TR");

function isAllowedChar(char: string): boolean {
  return ALLOWED_LETTERS.test(char) || /^[0-9]$/.test(char) || PASSWORD_SYMBOLS.includes(char);
}

function personalParts(ctx: PasswordContext): string[] {
  const parts = [ctx.email?.split("@")[0], ...(ctx.firstName?.split(/\s+/) ?? []), ...(ctx.lastName?.split(/\s+/) ?? [])];
  return parts.filter((p): p is string => !!p && p.length >= MIN_PERSONAL_PART).map(normalize);
}

/** Başarısız kuralları döner; boş dizi = geçerli. */
export function checkPassword(password: string, ctx: PasswordContext = {}): PasswordRule[] {
  const failed: PasswordRule[] = [];
  const chars = Array.from(password); // emoji gibi çok birimli karakterleri tek sayar
  if (chars.length < PASSWORD_MIN || chars.length > PASSWORD_MAX) failed.push("length");
  if (!chars.some((c) => LETTER.test(c))) failed.push("letter");
  if (!chars.some((c) => PASSWORD_SYMBOLS.includes(c))) failed.push("symbol");
  if (!chars.every(isAllowedChar)) failed.push("allowedChars");
  const lowered = normalize(password);
  if (personalParts(ctx).some((part) => lowered.includes(part))) failed.push("noPersonalInfo");
  return failed;
}
