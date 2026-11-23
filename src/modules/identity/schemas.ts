import { z } from "zod";

import { checkPassword, PASSWORD_MAX } from "./password-policy";

/**
 * Kimlik formlarının zod şemaları. Hata mesajları `messages/*.json` anahtarlarıdır;
 * action katmanında çevrilir. Saf modül: client bileşenler de import edebilir.
 */

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const emailField = z
  .string({ error: "validation.required" })
  .trim()
  .toLowerCase()
  .min(1, { error: "validation.required" })
  .max(254, { error: "validation.tooLong" })
  .pipe(z.email({ error: "validation.email" }));

const nameField = z
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

const phoneField = z
  .string({ error: "validation.required" })
  .trim()
  .min(1, { error: "validation.required" })
  .transform(normalizePhone)
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, { error: "validation.phone" }));

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;
const birthDateField = z
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

const passwordField = z
  .string({ error: "validation.required" })
  .min(1, { error: "validation.required" })
  .max(PASSWORD_MAX * 4, { error: "validation.passwordPolicy" });

export const GENDERS = ["FEMALE", "MALE", "OTHER", "PREFER_NOT_TO_SAY"] as const;

export const checkEmailSchema = z.object({ email: emailField });

export const registerSchema = z
  .object({
    email: emailField,
    firstName: nameField,
    lastName: nameField,
    studentNo: z
      .string({ error: "validation.required" })
      .trim()
      .regex(/^[A-Za-z0-9]{4,20}$/, { error: "validation.studentNo" }),
    facultyId: z.string({ error: "validation.required" }).min(1, { error: "validation.required" }),
    departmentId: z.string({ error: "validation.required" }).min(1, { error: "validation.required" }),
    // Hangisinin zorunlu olduğu domain tipine göre serviste kontrol edilir.
    classYear: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(6).optional()),
    graduationYear: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number({ error: "validation.graduationYear" })
        .int({ error: "validation.graduationYear" })
        .min(1950, { error: "validation.graduationYear" })
        .max(new Date().getUTCFullYear() + 1, { error: "validation.graduationYear" })
        .optional(),
    ),
    phone: phoneField,
    gender: z.enum(GENDERS, { error: "validation.required" }),
    birthDate: birthDateField,
    password: passwordField,
    passwordConfirm: z.string({ error: "validation.required" }),
    kvkk: z.literal("on", { error: "validation.kvkk" }),
  })
  .superRefine((data, ctx) => {
    const failed = checkPassword(data.password, {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
    });
    if (failed.length > 0) ctx.addIssue({ code: "custom", path: ["password"], message: "validation.passwordPolicy" });
    if (data.password !== data.passwordConfirm) {
      ctx.addIssue({ code: "custom", path: ["passwordConfirm"], message: "validation.passwordMismatch" });
    }
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const otpSchema = z.object({
  code: z
    .string({ error: "validation.otp" })
    .transform((v) => v.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{6}$/, { error: "validation.otp" })),
});

export const loginSchema = z.object({
  email: emailField,
  password: passwordField,
  next: z.string().optional(),
});

export const forgotPasswordSchema = z.object({ email: emailField });

/** Şifre + tekrar kontrolü (kişisel bilgi kontrolü serviste, kullanıcının profiliyle). */
function refineNewPassword(data: { password: string; passwordConfirm: string }, ctx: z.RefinementCtx): void {
  if (checkPassword(data.password).length > 0) {
    ctx.addIssue({ code: "custom", path: ["password"], message: "validation.passwordPolicy" });
  }
  if (data.password !== data.passwordConfirm) {
    ctx.addIssue({ code: "custom", path: ["passwordConfirm"], message: "validation.passwordMismatch" });
  }
}

const passwordConfirmField = z.string({ error: "validation.required" });

export const resetPasswordSchema = z
  .object({ token: z.string().min(10).max(200), password: passwordField, passwordConfirm: passwordConfirmField })
  .superRefine(refineNewPassword);

export const changePasswordSchema = z
  .object({ currentPassword: passwordField, password: passwordField, passwordConfirm: passwordConfirmField })
  .superRefine(refineNewPassword);

export const changeEmailSchema = z.object({ email: emailField });
