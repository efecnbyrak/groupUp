import "server-only";

import { db } from "@/lib/db";
import type { Prisma } from "@/lib/db-types";

const manageRegistrationSelect = {
  id: true,
  userId: true,
  teamId: true,
  status: true,
  answers: true,
  profileSnapshot: true,
  waitlistPos: true,
  createdAt: true,
  team: { select: { id: true, name: true, status: true } },
  user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true, avatarKey: true } } } },
} as const satisfies Prisma.RegistrationSelect;

/** Kulüp paneli yönetim tablosu: etkinliğin tüm bireysel başvuruları (takım modunda da her üyenin satırı). */
export async function listRegistrationsForManage(clubId: string, eventId: string) {
  const event = await db.event.findFirst({ where: { id: eventId, clubId }, select: { id: true, mode: true } });
  if (!event) return null;
  const rows = await db.registration.findMany({ where: { eventId }, orderBy: [{ createdAt: "asc" }], select: manageRegistrationSelect });
  return { mode: event.mode, items: rows };
}

const teamManageSelect = {
  id: true,
  name: true,
  code: true,
  status: true,
  lockedAt: true,
  captainId: true,
  createdAt: true,
  members: { select: { userId: true, user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } } } },
} as const satisfies Prisma.TeamSelect;

export async function listTeamsForManage(clubId: string, eventId: string) {
  const event = await db.event.findFirst({ where: { id: eventId, clubId, mode: "TEAM" }, select: { id: true, teamMinSize: true } });
  if (!event) return null;
  const teams = await db.team.findMany({ where: { eventId }, orderBy: [{ createdAt: "asc" }], select: teamManageSelect });
  return { teamMinSize: event.teamMinSize ?? 1, items: teams };
}

/** Kullanıcının kendi (bireysel modda) başvurusu. */
export function getMyRegistration(eventId: string, userId: string) {
  return db.registration.findUnique({ where: { eventId_userId: { eventId, userId } }, select: { id: true, status: true, answers: true, waitlistPos: true, teamId: true, createdAt: true } });
}

const myListSelect = {
  id: true,
  status: true,
  waitlistPos: true,
  teamId: true,
  createdAt: true,
  event: {
    select: {
      id: true,
      slug: true,
      titleTr: true,
      titleEn: true,
      status: true,
      startAt: true,
      coverKey: true,
      mode: true,
      club: { select: { slug: true, name: true, logoKey: true } },
    },
  },
} as const satisfies Prisma.RegistrationSelect;

/** "Başvurularım": kullanıcının tüm bireysel + takım üyeliği başvuruları, yaklaşana göre. */
export function listMyRegistrations(userId: string) {
  return db.registration.findMany({
    where: { userId, status: { not: "CANCELLED" } },
    orderBy: [{ event: { startAt: "asc" } }],
    select: myListSelect,
  });
}

export function listFieldsPublic(eventId: string) {
  return db.eventFormField.findMany({ where: { eventId, hidden: false }, orderBy: { order: "asc" } });
}

export function countAccepted(eventId: string, mode: "INDIVIDUAL" | "TEAM") {
  return mode === "INDIVIDUAL"
    ? db.registration.count({ where: { eventId, status: { in: ["APPLIED", "ACCEPTED"] } } })
    : db.team.count({ where: { eventId, status: { in: ["APPLIED", "ACCEPTED"] }, lockedAt: { not: null } } });
}
