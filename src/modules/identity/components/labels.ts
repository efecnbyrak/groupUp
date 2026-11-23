import { pickMessages, type MessageKey, type Translate } from "@/i18n/messages";

/**
 * Her client formun ihtiyaç duyduğu metin anahtarları. Sayfa (server) `labelsFor(t, KEY_SET)`
 * ile çevirip prop olarak geçer. Ayrı dosyada: client modülünden sabit export edilemez.
 */
const common = ["common.loading", "common.show", "common.hide", "common.select"] as const;
const passwordRules = [
  "password.rulesTitle",
  "password.rules.length",
  "password.rules.letter",
  "password.rules.symbol",
  "password.rules.allowedChars",
  "password.rules.noPersonalInfo",
] as const;

export const REGISTER_KEYS = [
  ...common,
  ...passwordRules,
  "auth.fields.email",
  "auth.fields.password",
  "auth.fields.passwordConfirm",
  "auth.fields.firstName",
  "auth.fields.lastName",
  "auth.fields.studentNo",
  "auth.fields.faculty",
  "auth.fields.department",
  "auth.fields.classYear",
  "auth.fields.graduationYear",
  "auth.fields.phone",
  "auth.fields.gender",
  "auth.fields.birthDate",
  "auth.fields.kvkk",
  "auth.fields.universityName",
  "auth.fields.note",
  "auth.fields.emailPlain",
  "auth.classYears.0",
  "auth.classYears.1",
  "auth.classYears.2",
  "auth.classYears.3",
  "auth.classYears.4",
  "auth.classYears.5",
  "auth.classYears.6",
  "auth.genders.FEMALE",
  "auth.genders.MALE",
  "auth.genders.OTHER",
  "auth.genders.PREFER_NOT_TO_SAY",
  "auth.register.continue",
  "auth.register.submit",
  "auth.register.typeStudent",
  "auth.register.typeAlumni",
  "auth.register.changeEmail",
  "auth.register.notFoundTitle",
  "auth.register.notFoundBody",
  "auth.register.requestSubmit",
  "auth.register.alumniManualTitle",
  "auth.register.alumniManualBody",
  "auth.register.alumniUniversity",
  "auth.register.alumniContinue",
] as const satisfies readonly MessageKey[];

export const VERIFY_KEYS = [
  ...common,
  "auth.fields.code",
  "auth.verify.submit",
  "auth.verify.resend",
] as const satisfies readonly MessageKey[];

export const LOGIN_KEYS = [
  ...common,
  "auth.fields.emailPlain",
  "auth.fields.password",
  "auth.login.submit",
] as const satisfies readonly MessageKey[];

export const FORGOT_KEYS = [...common, "auth.fields.emailPlain", "auth.forgot.submit"] as const satisfies readonly MessageKey[];

export const RESET_KEYS = [
  ...common,
  ...passwordRules,
  "auth.fields.newPassword",
  "auth.fields.passwordConfirm",
  "auth.reset.submit",
] as const satisfies readonly MessageKey[];

export const SECURITY_KEYS = [
  ...common,
  ...passwordRules,
  "auth.fields.currentPassword",
  "auth.fields.newPassword",
  "auth.fields.passwordConfirm",
  "auth.fields.code",
  "auth.security.changePasswordSubmit",
  "auth.security.newEmail",
  "auth.security.changeEmailHint",
  "auth.security.sendCode",
  "auth.security.confirmEmail",
] as const satisfies readonly MessageKey[];

export type Labels<T extends readonly MessageKey[]> = Record<T[number], string>;

export function labelsFor<const T extends readonly MessageKey[]>(t: Translate, keys: T): Labels<T> {
  return pickMessages(t, keys);
}
