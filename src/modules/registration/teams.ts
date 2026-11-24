import "server-only";

import { audit } from "@/lib/audit";
import { db, type Tx } from "@/lib/db";
import type { Prisma } from "@/lib/db-types";
import { env } from "@/lib/env";
import { normalizeCode, randomCode } from "@/lib/ids";
import { getMailRecipient } from "@/modules/identity";
import { notify, sendEmailSafe } from "@/modules/notification";

import { toFieldDef } from "./fields";
import { canCompleteTeam, decideCapacity, teamSizeProblem, validateAnswers } from "./rules";
import { SNAPSHOT_COLUMNS, snapshotProfile } from "./registrations";
import { fail } from "./service";

export { SNAPSHOT_COLUMNS };

interface Actor {
  id: string;
}

const TEAM_CODE_LENGTH = 6;

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
  teamMinSize: true,
  teamMaxSize: true,
  titleTr: true,
  club: { select: { name: true } },
} as const satisfies Prisma.EventSelect;

async function loadEvent(client: Tx | typeof db, eventId: string) {
  const e = await client.event.findUnique({ where: { id: eventId }, select: eventSelect });
  if (!e) throw fail("NOT_FOUND");
  if (e.mode !== "TEAM") throw fail("WRONG_MODE");
  return e;
}

function assertWindowOpen(e: { status: string; applyOpensAt: Date | null; applyClosesAt: Date | null }, now: Date): void {
  if (e.status !== "PUBLISHED" || !e.applyOpensAt || !e.applyClosesAt || now < e.applyOpensAt || now >= e.applyClosesAt) throw fail("REGISTRATION_CLOSED");
}

async function assertMemberAndEligible(client: Tx | typeof db, clubId: string, eligibility: string, userId: string): Promise<void> {
  const membership = await client.membership.findUnique({ where: { clubId_userId: { clubId, userId } }, select: { status: true } });
  if (!membership || membership.status !== "ACTIVE") throw fail("NOT_CLUB_MEMBER");
  const user = await client.user.findUniqueOrThrow({ where: { id: userId }, select: { type: true } });
  if (eligibility === "STUDENTS_ONLY" && user.type !== "STUDENT") throw fail("NOT_ELIGIBLE");
  if (eligibility === "ALUMNI_ONLY" && user.type !== "ALUMNI") throw fail("NOT_ELIGIBLE");
}

async function assertNotAlreadyRegistered(client: Tx | typeof db, eventId: string, userId: string): Promise<void> {
  const existing = await client.registration.findUnique({ where: { eventId_userId: { eventId, userId } }, select: { id: true } });
  if (existing) throw fail("ALREADY_APPLIED");
}

const teamSelect = {
  id: true,
  eventId: true,
  name: true,
  code: true,
  captainId: true,
  status: true,
  answers: true,
  lockedAt: true,
  createdAt: true,
  members: {
    orderBy: { joinedAt: "asc" },
    select: { userId: true, joinedAt: true, user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } } },
  },
} as const satisfies Prisma.TeamSelect;

/** Kaptan "Takım kur": takım seviyesi alanlar + kaptanın kendi bireysel cevapları. */
export async function createTeam(actor: Actor, eventId: string, name: string, teamAnswers: Record<string, unknown>, memberAnswers: Record<string, unknown>): Promise<{ id: string; code: string }> {
  return db.$transaction(async (tx) => {
    const event = await loadEvent(tx, eventId);
    assertWindowOpen(event, new Date());
    await assertMemberAndEligible(tx, event.clubId, event.eligibility, actor.id);
    await assertNotAlreadyRegistered(tx, eventId, actor.id);

    const fieldRows = await tx.eventFormField.findMany({ where: { eventId, hidden: false }, orderBy: { order: "asc" } });
    const fields = fieldRows.map(toFieldDef);
    const team = validateAnswers(fields, teamAnswers, "team", `registrations/${eventId}/${actor.id}/`);
    const member = validateAnswers(fields, memberAnswers, "individual", `registrations/${eventId}/${actor.id}/`);
    const errors = { ...team.errors, ...member.errors };
    if (Object.keys(errors).length) throw fail("INVALID_ANSWERS", errors);

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const snapshot = await snapshotProfile(tx, actor.id);
        const row = await tx.team.create({
          data: { eventId, name, code: randomCode(TEAM_CODE_LENGTH), captainId: actor.id, answers: team.clean as unknown as Prisma.InputJsonValue },
          select: { id: true, code: true },
        });
        await tx.teamMember.create({ data: { teamId: row.id, userId: actor.id } });
        await tx.registration.create({
          data: { eventId, userId: actor.id, teamId: row.id, status: "APPLIED", answers: member.clean as unknown as Prisma.InputJsonValue, profileSnapshot: snapshot as unknown as Prisma.InputJsonValue },
        });
        await audit({ action: "registration.team.created", targetType: "Team", targetId: row.id, actorId: actor.id, universityId: event.universityId, meta: { eventId } }, tx);
        return row;
      } catch (err) {
        if (!isUniqueCodeViolation(err)) throw err;
      }
    }
    throw new Error("Takım kodu üretilemedi");
  });
}

function isUniqueCodeViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "P2002";
}

/** Üye kodla katılır: kendi bireysel cevaplarını doldurur. */
export async function joinTeam(actor: Actor, eventId: string, rawCode: string, memberAnswers: Record<string, unknown>): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const event = await loadEvent(tx, eventId);
    assertWindowOpen(event, new Date());
    await assertMemberAndEligible(tx, event.clubId, event.eligibility, actor.id);
    await assertNotAlreadyRegistered(tx, eventId, actor.id);

    const code = normalizeCode(rawCode, TEAM_CODE_LENGTH);
    if (!code) throw fail("CODE_INVALID");
    const team = await tx.team.findFirst({ where: { code, eventId }, select: { id: true, name: true, captainId: true, lockedAt: true, members: { select: { userId: true } } } });
    if (!team) throw fail("CODE_INVALID");
    if (team.lockedAt) throw fail("TEAM_FULL");
    if (team.members.length >= (event.teamMaxSize ?? Number.MAX_SAFE_INTEGER)) throw fail("TEAM_FULL");

    const fieldRows = await tx.eventFormField.findMany({ where: { eventId, hidden: false }, orderBy: { order: "asc" } });
    const fields = fieldRows.map(toFieldDef);
    const { errors, clean } = validateAnswers(fields, memberAnswers, "individual", `registrations/${eventId}/${actor.id}/`);
    if (Object.keys(errors).length) throw fail("INVALID_ANSWERS", errors);

    const snapshot = await snapshotProfile(tx, actor.id);
    await tx.teamMember.create({ data: { teamId: team.id, userId: actor.id } });
    const reg = await tx.registration.create({
      data: { eventId, userId: actor.id, teamId: team.id, status: "APPLIED", answers: clean as unknown as Prisma.InputJsonValue, profileSnapshot: snapshot as unknown as Prisma.InputJsonValue },
      select: { id: true },
    });
    await audit({ action: "registration.team.joined", targetType: "Team", targetId: team.id, actorId: actor.id, universityId: event.universityId, meta: { eventId } }, tx);
    await notify(
      {
        userId: team.captainId,
        type: "TEAM_UPDATE",
        titleTr: "Takımına yeni üye katıldı",
        titleEn: "A new member joined your team",
        bodyTr: team.name,
        bodyEn: team.name,
        href: "/etkinliklerim",
      },
      tx,
    );
    return reg;
  });
}

/** Kaptan üye çıkarır (kendini çıkaramaz). */
export async function removeTeamMember(actor: Actor, eventId: string, teamId: string, userId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const event = await loadEvent(tx, eventId);
    const team = await tx.team.findFirst({ where: { id: teamId, eventId }, select: { captainId: true, lockedAt: true } });
    if (!team) throw fail("NOT_FOUND");
    if (team.captainId !== actor.id) throw fail("NOT_CAPTAIN");
    if (userId === team.captainId) throw fail("CANNOT_REMOVE_CAPTAIN");
    if (team.lockedAt) throw fail("NOT_EDITABLE");
    const { count } = await tx.teamMember.deleteMany({ where: { teamId, userId } });
    if (count === 0) throw fail("NOT_FOUND");
    await tx.registration.deleteMany({ where: { eventId, userId, teamId } });
    await audit({ action: "registration.team.memberRemoved", targetType: "Team", targetId: teamId, actorId: actor.id, universityId: event.universityId, meta: { eventId, userId } }, tx);
  });
}

/** Üye kendi isteğiyle takımdan ayrılır (kaptan dahil olamaz — "disbandTeam" kullanır). */
export async function leaveTeam(actor: Actor, eventId: string, teamId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const event = await loadEvent(tx, eventId);
    assertWindowOpen(event, new Date());
    const team = await tx.team.findFirst({ where: { id: teamId, eventId }, select: { captainId: true, lockedAt: true } });
    if (!team) throw fail("NOT_FOUND");
    if (team.captainId === actor.id) throw fail("CANNOT_REMOVE_CAPTAIN");
    if (team.lockedAt) throw fail("NOT_EDITABLE");
    await tx.teamMember.deleteMany({ where: { teamId, userId: actor.id } });
    await tx.registration.deleteMany({ where: { eventId, userId: actor.id, teamId } });
    await audit({ action: "registration.team.left", targetType: "Team", targetId: teamId, actorId: actor.id, universityId: event.universityId, meta: { eventId } }, tx);
  });
}

export async function transferCaptain(actor: Actor, eventId: string, teamId: string, newCaptainId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const event = await loadEvent(tx, eventId);
    const team = await tx.team.findFirst({ where: { id: teamId, eventId }, select: { captainId: true, members: { select: { userId: true } } } });
    if (!team) throw fail("NOT_FOUND");
    if (team.captainId !== actor.id) throw fail("NOT_CAPTAIN");
    if (!team.members.some((m) => m.userId === newCaptainId)) throw fail("NOT_FOUND");
    await tx.team.update({ where: { id: teamId }, data: { captainId: newCaptainId } });
    await audit({ action: "registration.team.captainTransferred", targetType: "Team", targetId: teamId, actorId: actor.id, universityId: event.universityId, meta: { eventId, newCaptainId } }, tx);
  });
}

/** Kaptan takımı dağıtır (deadline'a kadar): tüm üyeler ve başvuruları silinir. */
export async function disbandTeam(actor: Actor, eventId: string, teamId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const event = await loadEvent(tx, eventId);
    const team = await tx.team.findFirst({ where: { id: teamId, eventId }, select: { captainId: true } });
    if (!team) throw fail("NOT_FOUND");
    if (team.captainId !== actor.id) throw fail("NOT_CAPTAIN");
    await tx.registration.deleteMany({ where: { eventId, teamId } });
    await tx.team.delete({ where: { id: teamId } });
    await audit({ action: "registration.team.disbanded", targetType: "Team", targetId: teamId, actorId: actor.id, universityId: event.universityId, meta: { eventId } }, tx);
  });
}

/** Kaptan "Başvuruyu tamamla": min boyuta ulaşınca kontenjan kararı verilir, roster kilitlenir. */
export async function completeTeam(actor: Actor, eventId: string, teamId: string): Promise<void> {
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
    const event = await loadEvent(tx, eventId);
    const team = await tx.team.findFirst({ where: { id: teamId, eventId }, select: { captainId: true, lockedAt: true, members: { select: { userId: true } } } });
    if (!team) throw fail("NOT_FOUND");
    if (team.captainId !== actor.id) throw fail("NOT_CAPTAIN");
    if (team.lockedAt) return { event, recipients: [] as { email: string; locale: string; name: string }[] };
    const min = event.teamMinSize ?? 1;
    const max = event.teamMaxSize ?? Number.MAX_SAFE_INTEGER;
    const problem = teamSizeProblem(team.members.length, min, max);
    if (problem === "TEAM_TOO_SMALL") throw fail("TEAM_TOO_SMALL");
    if (!canCompleteTeam(team.members.length, min)) throw fail("TEAM_TOO_SMALL");

    const taken = await tx.team.count({ where: { eventId, status: { in: ["APPLIED", "ACCEPTED"] }, lockedAt: { not: null } } });
    const decision = decideCapacity({ capacity: event.capacity, waitlistEnabled: event.waitlistEnabled, autoAccept: event.autoAccept, taken });
    if (decision.status === "BLOCKED") throw fail("FULL");
    const waitlistPos = decision.status === "WAITLISTED" ? (await tx.team.count({ where: { eventId, status: "WAITLISTED" } })) + 1 : null;

    await tx.team.update({ where: { id: teamId }, data: { status: decision.status, lockedAt: new Date() } });
    await tx.registration.updateMany({ where: { teamId }, data: { status: decision.status, waitlistPos } });
    await audit({ action: "registration.team.completed", targetType: "Team", targetId: teamId, actorId: actor.id, universityId: event.universityId, meta: { eventId, status: decision.status } }, tx);

    const recipients = [];
    for (const m of team.members) {
      const r = await getMailRecipient(tx, m.userId);
      if (r) recipients.push({ ...r, userId: m.userId });
    }
    return { event, recipients, outcome: decision.status === "ACCEPTED" ? ("accepted" as const) : decision.status === "WAITLISTED" ? ("waitlisted" as const) : null };
  });
  if (result.outcome) {
    for (const r of result.recipients) {
      await sendEmailSafe(r.email, "registration-decided", r.locale, {
        name: r.name,
        eventTitle: result.event.titleTr,
        clubName: result.event.club.name,
        outcome: result.outcome,
        url: `${env.APP_URL}/etkinliklerim`,
      });
      await notifyTeamOutcome(r.userId, result.event.titleTr, result.outcome);
    }
  }
}

async function notifyTeamOutcome(userId: string, eventTitle: string, outcome: "accepted" | "waitlisted" | "rejected"): Promise<void> {
  const titles: Record<typeof outcome, { tr: string; en: string }> = {
    accepted: { tr: "Takımının başvurusu kabul edildi", en: "Your team's application was accepted" },
    waitlisted: { tr: "Takımın yedek listede", en: "Your team is on the waitlist" },
    rejected: { tr: "Takımının başvurusu reddedildi", en: "Your team's application was rejected" },
  };
  await notify({ userId, type: "TEAM_UPDATE", titleTr: titles[outcome].tr, titleEn: titles[outcome].en, bodyTr: eventTitle, bodyEn: eventTitle, href: "/etkinliklerim" });
}

export async function getMyTeam(eventId: string, userId: string) {
  const member = await db.teamMember.findFirst({ where: { userId, team: { eventId } }, select: { team: { select: teamSelect } } });
  return member?.team ?? null;
}

export async function getTeamByCode(eventId: string, rawCode: string) {
  const code = normalizeCode(rawCode, TEAM_CODE_LENGTH);
  if (!code) return null;
  return db.team.findFirst({ where: { code, eventId }, select: { id: true, name: true, status: true, lockedAt: true, members: { select: { userId: true } } } });
}


/** Ekip tarafı: takımı manuel kabul/ret eder (bireysel kararın takım karşılığı). Üyelerin cevapları aynı durumu alır. */
export async function decideTeam(actor: Actor, clubId: string, eventId: string, teamId: string, decision: "ACCEPT" | "REJECT"): Promise<void> {
  const result = await db.$transaction(async (tx) => {
    const event = await tx.event.findFirst({ where: { id: eventId, clubId, mode: "TEAM" }, select: eventSelect });
    if (!event) throw fail("NOT_FOUND");
    const team = await tx.team.findFirst({ where: { id: teamId, eventId }, select: { id: true, members: { select: { userId: true } } } });
    if (!team) throw fail("NOT_FOUND");
    const status = decision === "ACCEPT" ? "ACCEPTED" : "REJECTED";
    await tx.team.update({ where: { id: teamId }, data: { status, lockedAt: new Date() } });
    await tx.registration.updateMany({ where: { teamId }, data: { status, waitlistPos: null } });
    await audit({ action: "registration.team.decided", targetType: "Team", targetId: teamId, actorId: actor.id, universityId: event.universityId, meta: { eventId, decision } }, tx);
    const recipients = [];
    for (const m of team.members) {
      const r = await getMailRecipient(tx, m.userId);
      if (r) recipients.push({ ...r, userId: m.userId });
    }
    return { event, recipients };
  });
  for (const r of result.recipients) {
    await sendEmailSafe(r.email, "registration-decided", r.locale, {
      name: r.name,
      eventTitle: result.event.titleTr,
      clubName: result.event.club.name,
      outcome: decision === "ACCEPT" ? "accepted" : "rejected",
      url: `${env.APP_URL}/etkinliklerim`,
    });
    await notifyTeamOutcome(r.userId, result.event.titleTr, decision === "ACCEPT" ? "accepted" : "rejected");
  }
}

export async function decideManyTeams(actor: Actor, clubId: string, eventId: string, teamIds: string[], decision: "ACCEPT" | "REJECT"): Promise<number> {
  let count = 0;
  for (const id of teamIds.slice(0, 200)) {
    try {
      await decideTeam(actor, clubId, eventId, id, decision);
      count++;
    } catch {
      // bireysel hata toplu işlemi durdurmaz
    }
  }
  return count;
}
