import "server-only";

import { toLocale } from "@/i18n/messages";
import { getMailProvider } from "@/lib/mail";

import { renderTemplate, type EmailTemplate, type EmailTemplates } from "./emails/templates";

/**
 * Şablonlu mail gönderir. Hata fırlatır — çağıran karar verir:
 * OTP akışlarında kullanıcıya hata gösterilir, diğerlerinde `sendEmailSafe` kullanılır (AUTH-EMAIL §10).
 */
export async function sendEmail<K extends EmailTemplate>(
  to: string,
  template: K,
  locale: string,
  data: EmailTemplates[K],
): Promise<void> {
  const rendered = renderTemplate(template, toLocale(locale), data);
  await getMailProvider().send({ to, ...rendered });
}

/** Bilgilendirme mailleri: gönderim hatası kullanıcı akışını bozmaz, loglanır. */
export async function sendEmailSafe<K extends EmailTemplate>(
  to: string,
  template: K,
  locale: string,
  data: EmailTemplates[K],
): Promise<void> {
  try {
    await sendEmail(to, template, locale, data);
  } catch (err) {
    console.error(`[mail] ${template} gönderilemedi`, err);
  }
}
