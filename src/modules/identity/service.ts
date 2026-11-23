import "server-only";

import { audit } from "@/lib/audit";
import { randomToken, sha256 } from "@/lib/crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { RateLimitError, ServiceError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/password";
import { enforceRateLimits } from "@/lib/rate-limit";
import { destroyUserSessions } from "@/lib/session";
import { sendEmail, sendEmailSafe } from "@/modules/notification";
import { getManualAlumniUniversity, isValidFacultyDepartment, resolveEmailDomain } from "@/modules/university";

import { consumeOtp, issueOtp, type OtpResult } from "./otp";
import { checkPassword } from "./password-policy";
import type { RegisterInput } from "./schemas";

/**
 * Kimlik iş kuralları — docs/AUTH-EMAIL.md. Request bağlamına (cookie/header) dokunmaz;
 * oturum açma/kapama action katmanındadır. Hatalar `IdentityError` olarak fırlatılır.
 */

export type IdentityErrorCode =
  | "UNIVERSITY_NOT_FOUND"
  | "INVALID_FIELDS"
  | "EMAIL_TAKEN"
  | "MAIL_FAILED"
  | "OTP_INVALID"
  | "OTP_EXPIRED"
  | "OTP_TOO_MANY"
  | "LOGIN_INVALID"
  | "SUSPENDED"
  | "RESET_TOKEN_INVALID"
  | "WRONG_PASSWORD"
  | "EMAIL_NOT_ALLOWED"
  | "NOT_FOUND"
  | "DELETE_TOKEN_INVALID"
  | "LAST_SUPER_ADMIN";

export const fail = (code: IdentityErrorCode, fields?: Record<string, string>) => new ServiceError<IdentityErrorCode>(code, fields);

const MIN = 60;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const RESET_TTL_MS = 30 * 60 * 1000;

/** Rate limit kuralları (AUTH-EMAIL §2, §3, §7). IP kuralları action'ın ilk satırında uygulanır. */
export const limits = {
  checkEmailIp: (ip: string) => [{ key: `check-email:ip:${ip}`, limit: 30, windowSec: HOUR }],
  registerIp: (ip: string) => [{ key: `register:ip:${ip}`, limit: 10, windowSec: HOUR }],
  verifyIp: (ip: string) => [{ key: `verify:ip:${ip}`, limit: 30, windowSec: 15 * MIN }],
  otpEmail: (email: string) => [
    { key: `otp:mail:${email}:60s`, limit: 1, windowSec: MIN },
    { key: `otp:mail:${email}:1h`, limit: 5, windowSec: HOUR },
    { key: `otp:mail:${email}:1d`, limit: 10, windowSec: DAY },
  ],
  resendIp: (ip: string) => [{ key: `otp:ip:${ip}`, limit: 20, windowSec: HOUR }],
  loginIp: (ip: string) => [{ key: `login:ip:${ip}`, limit: 20, windowSec: 15 * MIN }],
  loginEmail: (email: string) => [{ key: `login:mail:${email}`, limit: 10, windowSec: 15 * MIN }],
  forgotIp: (ip: string) => [{ key: `forgot:ip:${ip}`, limit: 10, windowSec: HOUR }],
  forgotEmail: (email: string) => [{ key: `forgot:mail:${email}`, limit: 3, windowSec: HOUR }],
  resetIp: (ip: string) => [{ key: `reset:ip:${ip}`, limit: 10, windowSec: HOUR }],
  accountUser: (userId: string) => [{ key: `account:user:${userId}`, limit: 10, windowSec: 15 * MIN }],
};

export function displayName(profile: { firstName: string } | null | undefined, email: string): string {
  return profile?.firstName ?? email.split("@")[0] ?? email;
}

// ---------------------------------------------------------------- Kayıt

export interface RegistrationContext {
  universityId: string;
  universityName: string;
  type: "STUDENT" | "ALUMNI";
}

/** Kayıt adım 1: mail hangi üniversiteye ait? (null → üniversite talebi formu) */
export async function resolveRegistration(email: string): Promise<RegistrationContext | null> {
  const resolved = await resolveEmailDomain(email);
  return resolved ? { universityId: resolved.universityId, universityName: resolved.universityName, type: resolved.type } : null;
}

/**
 * Domain çözümlenirse o kullanılır (seçilen üniversite yok sayılır). Çözümlenmezse ve
 * manuel mezun yolu açık bir üniversite seçildiyse → ALUMNI (belge ile doğrulanacak).
 */
async function resolveRegistrationTarget(email: string, universityId?: string): Promise<{ universityId: string; type: "STUDENT" | "ALUMNI" } | null> {
  const resolved = await resolveEmailDomain(email);
  if (resolved) return { universityId: resolved.universityId, type: resolved.type };
  if (!universityId) return null;
  const manual = await getManualAlumniUniversity(universityId);
  return manual ? { universityId: manual.id, type: "ALUMNI" } : null;
}

/** Manuel mezun mu? ALUMNI tipinde ama e-postası üniversitenin mezun domaininden değil. */
async function isManualAlumni(user: { type: string; universityId: string | null }, email: string): Promise<boolean> {
  if (user.type !== "ALUMNI") return false;
  const resolved = await resolveEmailDomain(email);
  return !(resolved?.type === "ALUMNI" && resolved.universityId === user.universityId);
}

/**
 * Kayıt (AUTH-EMAIL §1): User + Profile + OTP + audit tek transaction'da. Mail doğrulanmamış
 * eski kayıt varsa güncellenir. OTP maili gönderilemezse `MAIL_FAILED` (kayıt kalır, yeniden gönderilebilir).
 */
export async function register(input: RegisterInput, ctx: { locale: string }): Promise<{ email: string }> {
  const resolved = await resolveRegistrationTarget(input.email, input.universityId);
  if (!resolved) throw fail("UNIVERSITY_NOT_FOUND");

  const fields: Record<string, string> = {};
  if (!(await isValidFacultyDepartment(resolved.universityId, input.facultyId, input.departmentId))) {
    fields.departmentId = "validation.department";
  }
  if (resolved.type === "STUDENT" && input.classYear === undefined) fields.classYear = "validation.classYear";
  if (resolved.type === "ALUMNI" && input.graduationYear === undefined) fields.graduationYear = "validation.graduationYear";
  if (Object.keys(fields).length > 0) throw fail("INVALID_FIELDS", fields);

  const existing = await db.user.findUnique({
    where: { email: input.email },
    select: { id: true, emailVerifiedAt: true, status: true },
  });
  if (existing && (existing.emailVerifiedAt || existing.status !== "PENDING_VERIFICATION")) throw fail("EMAIL_TAKEN");

  const passwordHash = await hashPassword(input.password);
  const now = new Date();
  const profile = {
    firstName: input.firstName,
    lastName: input.lastName,
    studentNo: input.studentNo,
    facultyId: input.facultyId,
    departmentId: input.departmentId,
    classYear: resolved.type === "STUDENT" ? (input.classYear ?? null) : null,
    graduationYear: resolved.type === "ALUMNI" ? (input.graduationYear ?? null) : null,
    phone: input.phone,
    gender: input.gender,
    birthDate: input.birthDate,
    kvkkConsentAt: now,
  };
  const userData = {
    passwordHash,
    type: resolved.type,
    universityId: resolved.universityId,
    locale: ctx.locale,
    status: "PENDING_VERIFICATION" as const,
  };

  const code = await db.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { email: input.email },
      update: userData,
      create: { email: input.email, ...userData },
      select: { id: true },
    });
    await tx.profile.upsert({
      where: { userId: user.id },
      update: profile,
      create: { userId: user.id, ...profile },
    });
    const otp = await issueOtp(tx, { email: input.email, purpose: "VERIFY_EMAIL", userId: user.id });
    await audit(
      {
        action: existing ? "identity.user.reregistered" : "identity.user.registered",
        targetType: "User",
        targetId: user.id,
        actorId: user.id,
        universityId: resolved.universityId,
        meta: { type: resolved.type },
      },
      tx,
    );
    return otp;
  });

  await sendVerifyMail(input.email, code, ctx.locale, input.firstName);
  return { email: input.email };
}

async function sendVerifyMail(email: string, code: string, locale: string, name: string): Promise<void> {
  try {
    await sendEmail(email, "verify-email", locale, { name, code });
  } catch (err) {
    console.error("[identity] OTP maili gönderilemedi", err);
    throw fail("MAIL_FAILED");
  }
}

/**
 * Yeni doğrulama kodu (60 sn / 5 saat / 10 gün). Hesap yoksa veya zaten doğrulanmışsa
 * sessizce başarılı döner (kullanıcı sayımı yok).
 */
export async function resendVerification(email: string): Promise<void> {
  await enforceRateLimits(limits.otpEmail(email));
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, emailVerifiedAt: true, status: true, locale: true, profile: { select: { firstName: true } } },
  });
  if (!user || user.emailVerifiedAt || user.status !== "PENDING_VERIFICATION") return;
  const code = await db.$transaction((tx) => issueOtp(tx, { email, purpose: "VERIFY_EMAIL", userId: user.id }));
  await sendVerifyMail(email, code, user.locale, displayName(user.profile, email));
}

/** OTP sonucunu hataya çevirir; başarıda token'ın kullanıcısını döner. */
function otpOrThrow(result: OtpResult): string | null {
  switch (result.status) {
    case "ok":
      return result.userId;
    case "invalid":
      throw fail("OTP_INVALID");
    case "expired":
      throw fail("OTP_EXPIRED");
    case "tooMany":
      throw fail("OTP_TOO_MANY");
  }
}

/** OTP doğrulama → `emailVerifiedAt`, `status=ACTIVE`. Oturum action'da açılır. */
export async function verifyEmail(email: string, code: string): Promise<{ userId: string }> {
  const tokenUserId = otpOrThrow(await consumeOtp({ email, purpose: "VERIFY_EMAIL", code }));

  const user = await db.user.findUnique({ where: { email }, select: { id: true, universityId: true, status: true, type: true } });
  if (!user || (tokenUserId && tokenUserId !== user.id)) throw fail("OTP_EXPIRED");
  // Manuel mezun: mail doğrulandı ama belge onayı bekleniyor (AUTH-EMAIL §2, §6).
  const nextStatus = (await isManualAlumni(user, email)) ? ("PENDING_ALUMNI_REVIEW" as const) : ("ACTIVE" as const);

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        ...(user.status === "PENDING_VERIFICATION" ? { status: nextStatus } : {}),
      },
    });
    await audit(
      { action: "identity.email.verified", targetType: "User", targetId: user.id, actorId: user.id, universityId: user.universityId },
      tx,
    );
  });
  return { userId: user.id };
}

// ---------------------------------------------------------------- Giriş

export type LoginResult = { status: "ok"; userId: string } | { status: "needsVerification"; email: string };

/**
 * Giriş (AUTH-EMAIL §3). Kullanıcı yoksa da sahte hash doğrulanır; hata mesajı tek tip.
 * Doğrulanmamış hesapta yeni OTP gönderilir (gönderim limiti aşıldıysa eski kod geçerli kalır).
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  await enforceRateLimits(limits.loginEmail(email));
  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      passwordHash: true,
      status: true,
      deletedAt: true,
      emailVerifiedAt: true,
      universityId: true,
    },
  });
  const valid = await verifyPassword(user?.passwordHash, password);
  if (!user || !valid || user.deletedAt || user.status === "DELETED") throw fail("LOGIN_INVALID");
  if (user.status === "SUSPENDED") throw fail("SUSPENDED");

  if (!user.emailVerifiedAt) {
    try {
      await resendVerification(email);
    } catch (err) {
      if (!(err instanceof RateLimitError)) throw err;
    }
    return { status: "needsVerification", email };
  }

  await audit({
    action: "identity.user.login",
    targetType: "User",
    targetId: user.id,
    actorId: user.id,
    universityId: user.universityId,
  });
  return { status: "ok", userId: user.id };
}

// ---------------------------------------------------------------- Şifremi unuttum / sıfırla

/** Her zaman sessizce döner (hesap var/yok sızdırılmaz). Token 30 dk, tek kullanımlık. */
export async function requestPasswordReset(email: string): Promise<void> {
  await enforceRateLimits(limits.forgotEmail(email));
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, status: true, deletedAt: true, locale: true, profile: { select: { firstName: true } } },
  });
  if (!user || user.deletedAt || user.status === "DELETED" || user.status === "SUSPENDED") return;

  const token = randomToken();
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.emailToken.updateMany({
      where: { email, purpose: "PASSWORD_RESET", usedAt: null },
      data: { usedAt: now },
    });
    await tx.emailToken.create({
      data: {
        email,
        userId: user.id,
        purpose: "PASSWORD_RESET",
        codeHash: sha256(token),
        expiresAt: new Date(now.getTime() + RESET_TTL_MS),
      },
    });
  });
  const url = `${env.APP_URL}/sifre-sifirla?token=${encodeURIComponent(token)}`;
  await sendEmailSafe(email, "password-reset", user.locale, { name: displayName(user.profile, email), url });
}

async function findResetToken(token: string) {
  const row = await db.emailToken.findFirst({
    where: { codeHash: sha256(token), purpose: "PASSWORD_RESET", usedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, userId: true, email: true },
  });
  return row?.userId ? row : null;
}

/** Sıfırlama sayfası açılırken token'ın geçerliliğini kontrol eder. */
export async function isResetTokenValid(token: string): Promise<boolean> {
  return (await findResetToken(token)) !== null;
}

/**
 * Yeni şifre → tüm oturumlar silinir → "şifre değişti" maili. Link maile gittiği için
 * doğrulanmamış hesap da doğrulanmış sayılır.
 */
export async function resetPassword(token: string, password: string): Promise<void> {
  const row = await findResetToken(token);
  if (!row?.userId) throw fail("RESET_TOKEN_INVALID");
  const user = await db.user.findUnique({
    where: { id: row.userId },
    select: {
      id: true,
      email: true,
      status: true,
      emailVerifiedAt: true,
      locale: true,
      universityId: true,
      profile: { select: { firstName: true, lastName: true } },
    },
  });
  if (!user || user.email !== row.email) throw fail("RESET_TOKEN_INVALID");
  assertPasswordPolicy(password, user.email, user.profile);

  const passwordHash = await hashPassword(password);
  await db.$transaction(async (tx) => {
    const used = await tx.emailToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
    if (used.count !== 1) throw fail("RESET_TOKEN_INVALID");
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        ...(user.emailVerifiedAt ? {} : { emailVerifiedAt: new Date() }),
        ...(user.status === "PENDING_VERIFICATION" ? { status: "ACTIVE" as const } : {}),
      },
    });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await audit(
      { action: "identity.password.reset", targetType: "User", targetId: user.id, actorId: user.id, universityId: user.universityId },
      tx,
    );
  });
  await sendEmailSafe(user.email, "password-changed", user.locale, { name: displayName(user.profile, user.email) });
}

function assertPasswordPolicy(
  password: string,
  email: string,
  profile: { firstName: string; lastName: string } | null,
): void {
  const failed = checkPassword(password, { email, firstName: profile?.firstName, lastName: profile?.lastName });
  if (failed.length > 0) throw fail("INVALID_FIELDS", { password: "validation.passwordPolicy" });
}

// ---------------------------------------------------------------- Hesap işlemleri (AUTH-EMAIL §8)

interface Actor {
  id: string;
  sessionId: string;
}

/** Mevcut şifre + yeni şifre → diğer oturumlar kapanır → bildirim maili. */
export async function changePassword(actor: Actor, currentPassword: string, newPassword: string): Promise<void> {
  await enforceRateLimits(limits.accountUser(actor.id));
  const user = await db.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: {
      email: true,
      passwordHash: true,
      locale: true,
      universityId: true,
      profile: { select: { firstName: true, lastName: true } },
    },
  });
  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw fail("WRONG_PASSWORD", { currentPassword: "auth.security.wrongPassword" });
  }
  assertPasswordPolicy(newPassword, user.email, user.profile);

  const passwordHash = await hashPassword(newPassword);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: actor.id }, data: { passwordHash } });
    await audit(
      { action: "identity.password.changed", targetType: "User", targetId: actor.id, actorId: actor.id, universityId: user.universityId },
      tx,
    );
  });
  await destroyUserSessions(actor.id, actor.sessionId);
  await sendEmailSafe(user.email, "password-changed", user.locale, { name: displayName(user.profile, user.email) });
}

/**
 * Mail değişikliği adım 1: yeni adres aynı üniversitenin domaininde ve boşta olmalı.
 * Yeni adrese CHANGE_EMAIL OTP'si gider.
 */
export async function requestEmailChange(actor: Actor, newEmail: string): Promise<void> {
  await enforceRateLimits([...limits.accountUser(actor.id), ...limits.otpEmail(newEmail)]);
  const user = await db.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { email: true, universityId: true, locale: true, profile: { select: { firstName: true } } },
  });
  const resolved = await resolveEmailDomain(newEmail);
  const taken = await db.user.findUnique({ where: { email: newEmail }, select: { id: true } });
  if (!resolved || resolved.universityId !== user.universityId || taken || newEmail === user.email) {
    throw fail("EMAIL_NOT_ALLOWED", { email: "auth.security.emailNotAllowed" });
  }
  const code = await db.$transaction((tx) => issueOtp(tx, { email: newEmail, purpose: "CHANGE_EMAIL", userId: actor.id }));
  await sendVerifyMail(newEmail, code, user.locale, displayName(user.profile, user.email));
}

/**
 * Mail değişikliği adım 2: kod doğrulanınca giriş maili değişir; yeni domainin tipi
 * (öğrenci → mezun geçişi, AUTH-EMAIL §6) uygulanır; eski adrese bilgi maili gider.
 */
export async function confirmEmailChange(actor: Actor, newEmail: string, code: string): Promise<void> {
  const tokenUserId = otpOrThrow(await consumeOtp({ email: newEmail, purpose: "CHANGE_EMAIL", code }));
  if (tokenUserId !== actor.id) throw fail("OTP_EXPIRED");

  const user = await db.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { email: true, universityId: true, locale: true, profile: { select: { firstName: true } } },
  });
  const resolved = await resolveEmailDomain(newEmail);
  if (!resolved || resolved.universityId !== user.universityId) throw fail("EMAIL_NOT_ALLOWED");

  await db.$transaction(async (tx) => {
    const taken = await tx.user.findUnique({ where: { email: newEmail }, select: { id: true } });
    if (taken) throw fail("EMAIL_NOT_ALLOWED");
    await tx.user.update({
      where: { id: actor.id },
      data: { email: newEmail, type: resolved.type, emailVerifiedAt: new Date() },
    });
    await audit(
      {
        action: "identity.email.changed",
        targetType: "User",
        targetId: actor.id,
        actorId: actor.id,
        universityId: user.universityId,
        meta: { type: resolved.type },
      },
      tx,
    );
  });
  await sendEmailSafe(user.email, "email-changed", user.locale, {
    name: displayName(user.profile, user.email),
    newEmail,
  });
}
