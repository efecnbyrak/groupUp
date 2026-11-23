import "server-only";

import { audit } from "@/lib/audit";
import { db, type Tx } from "@/lib/db";
import type { Prisma } from "@/lib/db-types";
import { env } from "@/lib/env";
import { getMailRecipient } from "@/modules/identity";
import { sendEmailSafe } from "@/modules/notification";

import { toFieldDef } from "./fields";
import { decideCapacity, validateAnswers } from "./rules";
import { fail } from "./service";

interface Actor {
  id: string;
}

const eventSelect = {
  id: true,
  clubId: true,
  universityId: true,
  status: true,
  mode: true,
  eligibility: true,
  capacity: true,
  waitlistEnabled: true,
  autoAccept: true,
  autoPromoteWaitlist: true,
  applyOpensAt: true,
  applyClosesAt: true,
  titleTr: true,
  club: { select: { name: true } },
} as const satisfies Prisma.EventSelect;

async function loadEvent(client: Tx | typeof db, eventId: string) {
  const e = await client.event.findUnique({ where: { id: eventId }, select: eventSelect });
  if (!e) throw fail("NOT_FOUND");
  return e;
}

function assertWindowOpen(e: { status: string; applyOpensAt: Date | null; applyClosesAt: Date | null }, now: Date): void {
  if (e.status !== "PUBLISHED" || !e.applyOpensAt || !e.applyClosesAt || now < e.applyOpensAt || now >= e.applyClosesAt) throw fail("REGISTRATION_CLOSED");
}

async function assertMemberAndEligible(client: Tx | typeof db, clubId: string, eligibility: string, userId: string): Promise<{ type: string }> {
  const membership = await client.membership.findUnique({ where: { clubId_userId: { clubId, userId } }, select: { status: true } });
  if (!membership || membership.status !== "ACTIVE") throw fail("NOT_CLUB_MEMBER");
  const user = await client.user.findUniqueOrThrow({ where: { id: userId }, select: { type: true } });
  if (eligibility === "STUDENTS_ONLY" && user.type !== "STUDENT") throw fail("NOT_ELIGIBLE");
  if (eligibility === "ALUMNI_ONLY" && user.type !== "ALUMNI") throw fail("NOT_ELIGIBLE");
  return user;
}

/** Profil + öğrenci/mezun bilgisi, başvuru anında dondurulur (export sütunları `snapshotFields`). */
export async function snapshotProfile(client: Tx | typeof db, userId: string): Promise<Record<string, unknown>> {
  const u = await client.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      email: true,
      profile: {
        select: {
          firstName: true,
          lastName: true,
          studentNo: true,
          classYear: true,
          graduationYear: true,
          phone: true,
          faculty: { select: { nameTr: true } },
          department: { select: { nameTr: true } },
        },
      },
    },
  });
  return {
    adSoyad: [u.profile?.firstName, u.profile?.lastName].filter(Boolean).join(" ") || u.email,
    eposta: u.email,
    ogrenciNo: u.profile?.studentNo ?? "",
    fakulte: u.profile?.faculty?.nameTr ?? "",
    bolum: u.profile?.department?.nameTr ?? "",
    sinifMezuniyet: u.profile?.classYear ? `${u.profile.classYear}. sınıf` : u.profile?.graduationYear ? String(u.profile.graduationYear) : "",
    telefon: u.profile?.phone ?? "",
  };
}

export const SNAPSHOT_COLUMNS = [
  { key: "adSoyad", header: "Ad Soyad" },
  { key: "eposta", header: "E-posta" },
  { key: "ogrenciNo", header: "Öğrenci No" },
  { key: "fakulte", header: "Fakülte" },
  { key: "bolum", header: "Bölüm" },
  { key: "sinifMezuniyet", header: "Sınıf / Mezuniyet" },
  { key: "telefon", header: "Telefon" },
];

/** Bireysel başvuru (§5). Satır kilidi: Event FOR UPDATE, yarış durumu yok. */
export async function applyToEvent(actor: Actor, eventId: string, answers: Record<string, unknown>, now = new Date()): Promise<{ id: string; status: string }> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
    const event = await loadEvent(tx, eventId);
    if (event.mode !== "INDIVIDUAL") throw fail("WRONG_MODE");
    assertWindowOpen(event, now);
    await assertMemberAndEligible(tx, event.clubId, event.eligibility, actor.id);
    const existing = await tx.registration.findUnique({ where: { eventId_userId: { eventId, userId: actor.id } }, select: { id: true } });
    if (existing) throw fail("ALREADY_APPLIED");

    const fieldRows = await tx.eventFormField.findMany({ where: { eventId, hidden: false }, orderBy: { order: "asc" } });
    const fields = fieldRows.map(toFieldDef);
    const { errors, clean } = validateAnswers(fields, answers, "individual", `registrations/${eventId}/${actor.id}/`);
    if (Object.keys(errors).length) throw fail("INVALID_ANSWERS", errors);

    const taken = await tx.registration.count({ where: { eventId, status: { in: ["APPLIED", "ACCEPTED"] } } });
    const decision = decideCapacity({ capacity: event.capacity, waitlistEnabled: event.waitlistEnabled, autoAccept: event.autoAccept, taken });
    if (decision.status === "BLOCKED") throw fail("FULL");

    const waitlistPos = decision.status === "WAITLISTED" ? (await tx.registration.count({ where: { eventId, status: "WAITLISTED" } })) + 1 : null;
    const snapshot = await snapshotProfile(tx, actor.id);
    const row = await tx.registration.create({
      data: { eventId, userId: actor.id, status: decision.status, answers: clean as unknown as Prisma.InputJsonValue, profileSnapshot: snapshot as unknown as Prisma.InputJsonValue, waitlistPos },
      select: { id: true, status: true },
    });
    await audit({ action: "registration.applied", targetType: "Registration", targetId: row.id, actorId: actor.id, universityId: event.universityId, meta: { eventId, status: decision.status } }, tx);
    return row;
  });
}

/** Deadline'a kadar kendi cevaplarını düzenler. */
export async function updateMyAnswers(actor: Actor, eventId: string, answers: Record<string, unknown>, now = new Date()): Promise<void> {
  await db.$transaction(async (tx) => {
    const event = await loadEvent(tx, eventId);
    assertWindowOpen(event, now);
    const reg = await tx.registration.findUnique({ where: { eventId_userId: { eventId, userId: actor.id } }, select: { id: true, status: true } });
    if (!reg || reg.status === "CANCELLED" || reg.status === "REJECTED") throw fail("NOT_FOUND");
    const fieldRows = await tx.eventFormField.findMany({ where: { eventId, hidden: false }, orderBy: { order: "asc" } });
    const fields = fieldRows.map(toFieldDef);
    const { errors, clean } = validateAnswers(fields, answers, "individual", `registrations/${eventId}/${actor.id}/`);
    if (Object.keys(errors).length) throw fail("INVALID_ANSWERS", errors);
    await tx.registration.update({ where: { id: reg.id }, data: { answers: clean as unknown as Prisma.InputJsonValue } });
  });
}

async function promoteFromWaitlist(tx: Tx, eventId: string): Promise<{ userId: string; registrationId: string } | null> {
  const next = await tx.registration.findFirst({ where: { eventId, status: "WAITLISTED" }, orderBy: [{ waitlistPos: "asc" }, { createdAt: "asc" }], select: { id: true, userId: true } });
  if (!next) return null;
  await tx.registration.update({ where: { id: next.id }, data: { status: "ACCEPTED", waitlistPos: null } });
  return { userId: next.userId, registrationId: next.id };
}

/** Başvuruyu iptal eder; ACCEPTED ve autoPromoteWaitlist açıksa sıradaki yedek terfi eder (mail gider). */
export async function cancelRegistration(actor: Actor, eventId: string): Promise<void> {
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
    const event = await loadEvent(tx, eventId);
    const reg = await tx.registration.findUnique({ where: { eventId_userId: { eventId, userId: actor.id } }, select: { id: true, status: true } });
    if (!reg || reg.status === "CANCELLED") throw fail("NOT_FOUND");
    const wasAccepted = reg.status === "ACCEPTED";
    await tx.registration.update({ where: { id: reg.id }, data: { status: "CANCELLED", waitlistPos: null } });
    await audit({ action: "registration.cancelled", targetType: "Registration", targetId: reg.id, actorId: actor.id, universityId: event.universityId, meta: { eventId } }, tx);
    if (wasAccepted && event.autoPromoteWaitlist) {
      const promoted = await promoteFromWaitlist(tx, eventId);
      if (promoted) {
        const recipient = await getMailRecipient(tx, promoted.userId);
        return { event, recipient };
      }
    }
    return { event, recipient: null };
  });
  if (result.recipient) {
    await sendEmailSafe(result.recipient.email, "registration-decided", result.recipient.locale, {
      name: result.recipient.name,
      eventTitle: result.event.titleTr,
      clubName: result.event.club.name,
      outcome: "accepted",
      url: `${env.APP_URL}/etkinliklerim`,
    });
  }
}

type Decision = "ACCEPT" | "REJECT";

/** Ekip tarafı (REGISTRATION_MANAGE): manuel kabul/ret. Kontenjanı aşmak staff'ın kararıdır, engellenmez. */
export async function decideRegistration(actor: Actor, clubId: string, eventId: string, registrationId: string, decision: Decision): Promise<void> {
  const result = await db.$transaction(async (tx) => {
    const event = await tx.event.findFirst({ where: { id: eventId, clubId }, select: eventSelect });
    if (!event) throw fail("NOT_FOUND");
    const reg = await tx.registration.findFirst({ where: { id: registrationId, eventId }, select: { id: true, status: true, userId: true } });
    if (!reg || reg.status === "CANCELLED") throw fail("NOT_FOUND");
    const status = decision === "ACCEPT" ? "ACCEPTED" : "REJECTED";
    await tx.registration.update({ where: { id: reg.id }, data: { status, decidedById: actor.id, decidedAt: new Date(), waitlistPos: null } });
    await audit({ action: "registration.decided", targetType: "Registration", targetId: reg.id, actorId: actor.id, universityId: event.universityId, meta: { eventId, decision } }, tx);
    const recipient = await getMailRecipient(tx, reg.userId);
    return { event, recipient };
  });
  if (result.recipient) {
    await sendEmailSafe(result.recipient.email, "registration-decided", result.recipient.locale, {
      name: result.recipient.name,
      eventTitle: result.event.titleTr,
      clubName: result.event.club.name,
      outcome: decision === "ACCEPT" ? "accepted" : "rejected",
      url: `${env.APP_URL}/etkinliklerim`,
    });
  }
}

export async function decideManyRegistrations(actor: Actor, clubId: string, eventId: string, ids: string[], decision: Decision): Promise<number> {
  let count = 0;
  for (const id of ids.slice(0, 200)) {
    try {
      await decideRegistration(actor, clubId, eventId, id, decision);
      count++;
    } catch {
      // bireysel hata toplu işlemi durdurmaz (ör. zaten iptal edilmiş)
    }
  }
  return count;
}
