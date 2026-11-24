import "server-only";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { listActiveMemberIds } from "@/modules/club";
import { getMailRecipient } from "@/modules/identity";
import { notify, sendEmailSafe } from "@/modules/notification";

const WINDOW_START_MS = 23 * 60 * 60 * 1000;
const WINDOW_END_MS = 25 * 60 * 60 * 1000;

/**
 * F10 saatlik cron: başvuru süresi 24 saat içinde kapanan, henüz başvurmamış kulüp üyelerine
 * hatırlatma (AUTH-EMAIL §9 `deadline-reminder`). Her etkinlik için bir kez (`applyReminderSentAt`).
 */
export async function sendDeadlineReminders(now = new Date()): Promise<number> {
  const windowStart = new Date(now.getTime() + WINDOW_START_MS);
  const windowEnd = new Date(now.getTime() + WINDOW_END_MS);
  const events = await db.event.findMany({
    where: { status: "PUBLISHED", applyClosesAt: { gte: windowStart, lte: windowEnd }, applyReminderSentAt: null },
    select: { id: true, clubId: true, titleTr: true, club: { select: { name: true } } },
    take: 50,
  });
  let sent = 0;
  for (const event of events) {
    const [memberIds, registered] = await Promise.all([
      listActiveMemberIds(event.clubId),
      db.registration.findMany({ where: { eventId: event.id }, select: { userId: true } }),
    ]);
    const registeredIds = new Set(registered.map((r) => r.userId));
    const targets = memberIds.filter((id) => !registeredIds.has(id));
    for (const userId of targets) {
      const recipient = await getMailRecipient(db, userId);
      if (!recipient) continue;
      await sendEmailSafe(recipient.email, "deadline-reminder", recipient.locale, { name: recipient.name, eventTitle: event.titleTr, clubName: event.club.name, url: `${env.APP_URL}/etkinlikler/${event.id}` });
      await notify({ userId, type: "DEADLINE_REMINDER", titleTr: "Başvuru kapanıyor", titleEn: "Application closing", bodyTr: event.titleTr, bodyEn: event.titleTr, href: `/etkinlikler/${event.id}` });
      sent++;
    }
    await db.event.update({ where: { id: event.id }, data: { applyReminderSentAt: now } });
  }
  return sent;
}

/**
 * F10 saatlik cron: etkinlik 24 saat içinde başlıyorsa kabul edilen başvuru sahiplerine
 * hatırlatma (`event-reminder`). Her etkinlik için bir kez (`startReminderSentAt`).
 */
export async function sendEventReminders(now = new Date()): Promise<number> {
  const windowStart = new Date(now.getTime() + WINDOW_START_MS);
  const windowEnd = new Date(now.getTime() + WINDOW_END_MS);
  const events = await db.event.findMany({
    where: { status: "PUBLISHED", startAt: { gte: windowStart, lte: windowEnd }, startReminderSentAt: null },
    select: { id: true, titleTr: true, startAt: true },
    take: 50,
  });
  let sent = 0;
  for (const event of events) {
    const accepted = await db.registration.findMany({ where: { eventId: event.id, status: "ACCEPTED" }, select: { userId: true } });
    for (const { userId } of accepted) {
      const recipient = await getMailRecipient(db, userId);
      if (!recipient) continue;
      const when = event.startAt!.toLocaleString(recipient.locale === "en" ? "en-US" : "tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "medium", timeStyle: "short" });
      await sendEmailSafe(recipient.email, "event-reminder", recipient.locale, { name: recipient.name, eventTitle: event.titleTr, startAt: when, url: `${env.APP_URL}/etkinlikler/${event.id}` });
      await notify({ userId, type: "SYSTEM", titleTr: "Etkinlik yaklaşıyor", titleEn: "Event coming up", bodyTr: event.titleTr, bodyEn: event.titleTr, href: `/etkinlikler/${event.id}` });
      sent++;
    }
    await db.event.update({ where: { id: event.id }, data: { startReminderSentAt: now } });
  }
  return sent;
}
