import type { Locale } from "@/i18n/messages";

import { renderEmail, translatorFor, type RenderedEmail } from "./layout";

/** Kimlik mailleri (F2, hesap silme F4). Kalan şablonlar F10'da eklenir — AUTH-EMAIL §9. */
export interface EmailTemplates {
  "verify-email": { name: string; code: string };
  "password-reset": { name: string; url: string };
  "password-changed": { name: string };
  "email-changed": { name: string; newEmail: string };
  "delete-account": { name: string; url: string };
}

export type EmailTemplate = keyof EmailTemplates;

type Renderer<K extends EmailTemplate> = (locale: Locale, data: EmailTemplates[K]) => RenderedEmail;

const verifyEmail: Renderer<"verify-email"> = (locale, { name, code }) => {
  const t = translatorFor(locale);
  return renderEmail(locale, t("email.verify.subject", { code }), [
    { kind: "p", text: t("email.greeting", { name }) },
    { kind: "p", text: t("email.verify.intro") },
    { kind: "code", text: code },
    { kind: "muted", text: t("email.verify.expires") },
  ]);
};

const passwordReset: Renderer<"password-reset"> = (locale, { name, url }) => {
  const t = translatorFor(locale);
  return renderEmail(locale, t("email.passwordReset.subject"), [
    { kind: "p", text: t("email.greeting", { name }) },
    { kind: "p", text: t("email.passwordReset.intro") },
    { kind: "button", text: t("email.passwordReset.button"), href: url },
    { kind: "muted", text: t("email.passwordReset.expires") },
  ]);
};

const passwordChanged: Renderer<"password-changed"> = (locale, { name }) => {
  const t = translatorFor(locale);
  return renderEmail(locale, t("email.passwordChanged.subject"), [
    { kind: "p", text: t("email.greeting", { name }) },
    { kind: "p", text: t("email.passwordChanged.intro") },
    { kind: "muted", text: t("email.passwordChanged.warning") },
  ]);
};

const emailChanged: Renderer<"email-changed"> = (locale, { name, newEmail }) => {
  const t = translatorFor(locale);
  return renderEmail(locale, t("email.emailChanged.subject"), [
    { kind: "p", text: t("email.greeting", { name }) },
    { kind: "p", text: t("email.emailChanged.intro", { email: newEmail }) },
    { kind: "muted", text: t("email.emailChanged.warning") },
  ]);
};

const deleteAccount: Renderer<"delete-account"> = (locale, { name, url }) => {
  const t = translatorFor(locale);
  return renderEmail(locale, t("email.deleteAccount.subject"), [
    { kind: "p", text: t("email.greeting", { name }) },
    { kind: "p", text: t("email.deleteAccount.intro") },
    { kind: "button", text: t("email.deleteAccount.button"), href: url },
    { kind: "muted", text: t("email.deleteAccount.expires") },
  ]);
};

const renderers: { [K in EmailTemplate]: Renderer<K> } = {
  "verify-email": verifyEmail,
  "password-reset": passwordReset,
  "password-changed": passwordChanged,
  "email-changed": emailChanged,
  "delete-account": deleteAccount,
};

export function renderTemplate<K extends EmailTemplate>(template: K, locale: Locale, data: EmailTemplates[K]): RenderedEmail {
  return (renderers[template] as Renderer<K>)(locale, data);
}
