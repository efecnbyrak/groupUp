"use server";

import { redirect } from "next/navigation";

import { actionError, formToObject, invalidForm } from "@/i18n/action-result";
import type { MessageKey } from "@/i18n/messages";
import { getLocale, getT } from "@/i18n/server";
import { getSessionUser, requireUser } from "@/lib/authz";
import { ServiceError, type ActionResult } from "@/lib/errors";
import { enforceRateLimits } from "@/lib/rate-limit";
import { createSession, currentIpKey, destroyCurrentSession, destroyUserSessions } from "@/lib/session";
import { listFacultiesWithDepartments, type FacultyOption } from "@/modules/university";

import {
  changeEmailSchema,
  changePasswordSchema,
  checkEmailSchema,
  forgotPasswordSchema,
  loginSchema,
  otpSchema,
  registerSchema,
  resetPasswordSchema,
} from "./schemas";
import {
  changePassword,
  confirmEmailChange,
  limits,
  login,
  register,
  requestEmailChange,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  resolveRegistration,
  verifyEmail,
  type IdentityErrorCode,
} from "./service";
import { clearPendingVerification, getPendingVerification, setPendingVerification } from "./verify-cookie";

/**
 * Kimlik Server Action'ları — ince katman: authz / rate limit → zod → service.
 * Public action'ların ilk işi IP rate limit'idir. `redirect()` try bloğunun dışında çağrılır.
 */

const ERROR_KEYS: Partial<Record<IdentityErrorCode, MessageKey>> = {
  UNIVERSITY_NOT_FOUND: "auth.register.notFoundTitle",
  INVALID_FIELDS: "errors.invalidForm",
  EMAIL_TAKEN: "auth.register.emailTaken",
  MAIL_FAILED: "errors.mailFailed",
  OTP_INVALID: "auth.verify.invalid",
  OTP_EXPIRED: "auth.verify.expired",
  OTP_TOO_MANY: "auth.verify.tooMany",
  LOGIN_INVALID: "auth.login.invalid",
  SUSPENDED: "auth.login.suspended",
  RESET_TOKEN_INVALID: "auth.reset.invalidToken",
  WRONG_PASSWORD: "errors.invalidForm",
  EMAIL_NOT_ALLOWED: "auth.security.emailNotAllowed",
};

const isCode = (err: unknown, code: IdentityErrorCode) => err instanceof ServiceError && err.code === code;

/** Yalnızca site içi relatif yollar (açık yönlendirme yok). */
function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/hesap";
}

// ---------------------------------------------------------------- Kayıt

export type CheckEmailData =
  | { status: "found"; email: string; universityName: string; type: "STUDENT" | "ALUMNI"; faculties: FacultyOption[] }
  | { status: "notFound"; email: string };

/** Kayıt adım 1: domain çözümle → fakülte/bölüm listesi veya üniversite talebi. */
export async function checkEmailAction(
  _prev: ActionResult<CheckEmailData> | null,
  formData: FormData,
): Promise<ActionResult<CheckEmailData>> {
  const t = await getT();
  try {
    await enforceRateLimits(limits.checkEmailIp(await currentIpKey()));
    const parsed = checkEmailSchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalidForm(parsed.error, t);
    const { email } = parsed.data;
    const ctx = await resolveRegistration(email);
    if (!ctx) return { ok: true, data: { status: "notFound", email } };
    const faculties = await listFacultiesWithDepartments(ctx.universityId);
    return { ok: true, data: { status: "found", email, universityName: ctx.universityName, type: ctx.type, faculties } };
  } catch (err) {
    return actionError(err, t, ERROR_KEYS);
  }
}

export async function registerAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const t = await getT();
  let target = "/dogrula";
  try {
    await enforceRateLimits(limits.registerIp(await currentIpKey()));
    const parsed = registerSchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalidForm(parsed.error, t);
    try {
      await register(parsed.data, { locale: await getLocale() });
    } catch (err) {
      if (!isCode(err, "MAIL_FAILED")) throw err;
      // Kayıt oluştu ama kod gönderilemedi → doğrulama sayfasında hata + "tekrar gönder".
      target = "/dogrula?hata=mail";
    }
    await setPendingVerification(parsed.data.email);
  } catch (err) {
    return actionError(err, t, ERROR_KEYS);
  }
  redirect(target);
}

// ---------------------------------------------------------------- Doğrulama

export async function verifyEmailAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const t = await getT();
  try {
    await enforceRateLimits(limits.verifyIp(await currentIpKey()));
    const email = await getPendingVerification();
    if (!email) return { ok: false, error: t("auth.verify.noPending") };
    const parsed = otpSchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalidForm(parsed.error, t);
    const { userId } = await verifyEmail(email, parsed.data.code);
    await createSession(userId);
    await clearPendingVerification();
  } catch (err) {
    return actionError(err, t, ERROR_KEYS);
  }
  redirect("/hesap");
}

export async function resendOtpAction(_prev: ActionResult | null, _formData: FormData): Promise<ActionResult> {
  const t = await getT();
  try {
    await enforceRateLimits(limits.resendIp(await currentIpKey()));
    const email = await getPendingVerification();
    if (!email) return { ok: false, error: t("auth.verify.noPending") };
    await resendVerification(email);
    await setPendingVerification(email); // süreyi tazele
    return { ok: true, message: t("auth.verify.resent") };
  } catch (err) {
    return actionError(err, t, ERROR_KEYS);
  }
}

// ---------------------------------------------------------------- Giriş / çıkış

export async function loginAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const t = await getT();
  let target: string;
  try {
    await enforceRateLimits(limits.loginIp(await currentIpKey()));
    const parsed = loginSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: t("auth.login.invalid") };
    const result = await login(parsed.data.email, parsed.data.password);
    if (result.status === "needsVerification") {
      await setPendingVerification(result.email);
      target = "/dogrula";
    } else {
      await createSession(result.userId);
      target = safeNext(parsed.data.next);
    }
  } catch (err) {
    return actionError(err, t, ERROR_KEYS);
  }
  redirect(target);
}

export async function logoutAction(): Promise<void> {
  await getSessionUser(); // oturum yoksa da çıkış güvenle tamamlanır
  await destroyCurrentSession();
  redirect("/giris");
}

export async function logoutAllAction(): Promise<void> {
  const user = await requireUser();
  await destroyUserSessions(user.id);
  await destroyCurrentSession();
  redirect("/giris");
}

// ---------------------------------------------------------------- Şifremi unuttum / sıfırla

export async function forgotPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const t = await getT();
  try {
    await enforceRateLimits(limits.forgotIp(await currentIpKey()));
    const parsed = forgotPasswordSchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalidForm(parsed.error, t);
    await requestPasswordReset(parsed.data.email);
    return { ok: true, message: t("auth.forgot.sent") };
  } catch (err) {
    return actionError(err, t, ERROR_KEYS);
  }
}

export async function resetPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const t = await getT();
  try {
    await enforceRateLimits(limits.resetIp(await currentIpKey()));
    const parsed = resetPasswordSchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalidForm(parsed.error, t);
    await resetPassword(parsed.data.token, parsed.data.password);
    await destroyCurrentSession();
  } catch (err) {
    return actionError(err, t, ERROR_KEYS);
  }
  redirect("/giris?sifirlandi=1");
}

// ---------------------------------------------------------------- Hesap işlemleri

export async function changePasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const t = await getT();
  try {
    const user = await requireUser();
    const parsed = changePasswordSchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalidForm(parsed.error, t);
    await changePassword(user, parsed.data.currentPassword, parsed.data.password);
    return { ok: true, message: t("auth.security.passwordChanged") };
  } catch (err) {
    return actionError(err, t, ERROR_KEYS);
  }
}

export async function requestEmailChangeAction(
  _prev: ActionResult<{ email: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ email: string }>> {
  const t = await getT();
  try {
    const user = await requireUser();
    const parsed = changeEmailSchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalidForm(parsed.error, t);
    await requestEmailChange(user, parsed.data.email);
    return { ok: true, message: t("auth.security.codeSent", { email: parsed.data.email }), data: { email: parsed.data.email } };
  } catch (err) {
    return actionError(err, t, ERROR_KEYS);
  }
}

export async function confirmEmailChangeAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const t = await getT();
  try {
    const user = await requireUser();
    const parsedEmail = changeEmailSchema.safeParse(formToObject(formData));
    const parsedCode = otpSchema.safeParse(formToObject(formData));
    if (!parsedEmail.success) return invalidForm(parsedEmail.error, t);
    if (!parsedCode.success) return invalidForm(parsedCode.error, t);
    await confirmEmailChange(user, parsedEmail.data.email, parsedCode.data.code);
    return { ok: true, message: t("auth.security.emailChanged") };
  } catch (err) {
    return actionError(err, t, ERROR_KEYS);
  }
}
