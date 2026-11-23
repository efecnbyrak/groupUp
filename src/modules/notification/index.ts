// notification modülünün public API'si. Uygulama içi bildirimler F10'da eklenir.
export { sendEmail, sendEmailSafe } from "./service";
export { renderTemplate, type EmailTemplate, type EmailTemplates } from "./emails/templates";
export type { RenderedEmail } from "./emails/layout";
