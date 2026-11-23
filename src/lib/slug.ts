/**
 * URL slug'ı: Türkçe harfler ASCII'ye, diğer her şey tireye. Saf fonksiyon (sunucu + istemci).
 * Örn. "İstanbul Kent Üniversitesi" → "istanbul-kent-universitesi".
 */
const TR_MAP: Record<string, string> = { ç: "c", ğ: "g", ı: "i", İ: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", Ö: "o", Ş: "s", Ü: "u" };

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(input: string, maxLength = 80): string {
  return input
    .replace(/[çğıİöşüÇĞÖŞÜ]/g, (ch) => TR_MAP[ch] ?? ch)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}
