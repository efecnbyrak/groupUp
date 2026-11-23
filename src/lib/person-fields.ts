import { z } from "zod";

/**
 * Kişi alanlarının ortak zod şemaları (kayıt formu + profil düzenleme). Saf modül;
 * hata mesajları `messages/*.json` anahtarlarıdır.
 */
export const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const nameField = z
  .string({ error: "validation.required" })
  .trim()
  .min(1, { error: "validation.required" })
  .max(60, { error: "validation.tooLong" })
  .regex(/^[\p{L}][\p{L}\s'’-]*$/u, { error: "validation.name" });

/** "0555 123 45 67" / "+90 555..." → "+905551234567" (E.164). */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[\s().-]/g, "");
  if (/^0\d{10}$/.test(digits)) return `+9${digits}`;
  if (/^5\d{9}$/.test(digits)) return `+90${digits}`;
  return digits;
}

export const phoneField = z
  .string({ error: "validation.required" })
  .trim()
  .min(1, { error: "validation.required" })
  .transform(normalizePhone)
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, { error: "validation.phone" }));

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;
export const birthDateField = z
  .string({ error: "validation.required" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "validation.birthDate" })
  .transform((v) => new Date(`${v}T00:00:00.000Z`))
  .refine(
    (d) => {
      const age = (Date.now() - d.getTime()) / YEAR_MS;
      return !Number.isNaN(d.getTime()) && age >= 13 && age <= 100;
    },
    { error: "validation.birthDate" },
  );

export const studentNoField = z
  .string({ error: "validation.required" })
  .trim()
  .regex(/^[A-Za-z0-9]{4,20}$/, { error: "validation.studentNo" });

export const GENDERS = ["FEMALE", "MALE", "OTHER", "PREFER_NOT_TO_SAY"] as const;
export const genderField = z.enum(GENDERS, { error: "validation.required" });

/** Hangisinin zorunlu olduğu kullanıcı tipine göre serviste kontrol edilir. */
export const classYearField = z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(6).optional());
export const graduationYearField = z.preprocess(
  emptyToUndefined,
  z.coerce
    .number({ error: "validation.graduationYear" })
    .int({ error: "validation.graduationYear" })
    .min(1950, { error: "validation.graduationYear" })
    .max(new Date().getUTCFullYear() + 1, { error: "validation.graduationYear" })
    .optional(),
);
