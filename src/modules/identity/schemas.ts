import { z } from "zod";

import {
  birthDateField,
  classYearField,
  genderField,
  graduationYearField,
  nameField,
  emptyToUndefined,
  phoneField,
  studentNoField,
} from "@/lib/person-fields";

import { checkPassword, PASSWORD_MAX } from "./password-policy";

/**
 * Kimlik formlarının zod şemaları. Hata mesajları `messages/*.json` anahtarlarıdır;
 * action katmanında çevrilir. Saf modül: client bileşenler de import edebilir.
 */

export const emailField = z
  .string({ error: "validation.required" })
  .trim()
  .toLowerCase()
  .min(1, { error: "validation.required" })
  .max(254, { error: "validation.tooLong" })
  .pipe(z.email({ error: "validation.email" }));

const passwordField = z
  .string({ error: "validation.required" })
  .min(1, { error: "validation.required" })
  .max(PASSWORD_MAX * 4, { error: "validation.passwordPolicy" });

export const checkEmailSchema = z.object({ email: emailField });

export const chooseAlumniUniversitySchema = z.object({ email: emailField, universityId: z.string({ error: "validation.required" }).trim().min(1, { error: "validation.required" }).max(40) });

export const registerSchema = z
  .object({
    email: emailField,
    firstName: nameField,
    lastName: nameField,
    studentNo: studentNoField,
    facultyId: z.string({ error: "validation.required" }).min(1, { error: "validation.required" }),
    departmentId: z.string({ error: "validation.required" }).min(1, { error: "validation.required" }),
    // Hangisinin zorunlu olduğu domain tipine göre serviste kontrol edilir.
    classYear: classYearField,
    graduationYear: graduationYearField,
    phone: phoneField,
    gender: genderField,
    birthDate: birthDateField,
    password: passwordField,
    passwordConfirm: z.string({ error: "validation.required" }),
    kvkk: z.literal("on", { error: "validation.kvkk" }),
    /** Yalnızca manuel mezun yolu: domain çözümlenemeyen kişisel mail + seçilen üniversite. */
    universityId: z.preprocess(emptyToUndefined, z.string().max(40).optional()),
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
