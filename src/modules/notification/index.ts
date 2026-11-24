// notification modülünün public API'si (ARCHITECTURE §4: hiçbir modülü import etmez — bağımlılık tek yönlü diğerlerinden buraya).
export { markAllNotificationsReadAction, markAllNotificationsReadFormAction, markNotificationReadAction, markNotificationReadFormAction } from "./actions";
export { renderTemplate, type EmailTemplate, type EmailTemplates } from "./emails/templates";
export type { RenderedEmail } from "./emails/layout";
export { listNotifications, markAllNotificationsRead, markNotificationRead, notify, notifyMany, recentNotifications, type NotifyInput } from "./notifications";
export { sendEmail, sendEmailSafe } from "./service";
