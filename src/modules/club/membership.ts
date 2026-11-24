import "server-only";

import { audit } from "@/lib/audit";
import type { StaffPermissionName } from "@/lib/club-roles";
import { db, type Tx } from "@/lib/db";
import { normalizeCode, randomCode } from "@/lib/ids";
import { enforceRateLimits } from "@/lib/rate-limit";

import type { InviteCreateInput } from "./schemas";
import { fail, isUniqueViolation } from "./service";

interface Actor {
  id: string;
  universityId: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------- Davet kodları

export async function createInvite(actor: { id: string }, clubId: string, input: Omit<InviteCreateInput, "clubId">, now = new Date()): Promise<{ id: string; code: string }> {
  const expiresAt = input.expiresIn === "never" ? null : new Date(now.getTime() + Number(input.expiresIn) * DAY_MS);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const club = await tx.club.findFirst({ where: { id: clubId, deletedAt: null }, select: { universityId: true } });
        if (!club) throw fail("NOT_FOUND");
        const invite = await tx.clubInvite.create({
          data: { clubId, code: randomCode(), createdById: actor.id, maxUses: input.maxUses, expiresAt },
          select: { id: true, code: true },
        });
        await audit({ action: "club.invite.created", targetType: "ClubInvite", targetId: invite.id, actorId: actor.id, universityId: club.universityId, meta: { clubId, maxUses: input.maxUses, expiresIn: input.expiresIn } }, tx);
        return invite;
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err; // kod çakışması → yeniden dene
    }
  }
  throw new Error("Davet kodu üretilemedi");
}

export async function revokeInvite(actor: { id: string }, clubId: string, inviteId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const { count } = await tx.clubInvite.updateMany({ where: { id: inviteId, clubId, revokedAt: null }, data: { revokedAt: new Date() } });
    if (count === 0) throw fail("NOT_FOUND");
    await audit({ action: "club.invite.revoked", targetType: "ClubInvite", targetId: inviteId, actorId: actor.id, meta: { clubId } }, tx);
  });
}

export type InviteState = "VALID" | "EXPIRED" | "REVOKED" | "USED_UP";

export function inviteState(invite: { revokedAt: Date | null; expiresAt: Date | null; maxUses: number | null; usedCount: number }, now: Date): InviteState {
  if (invite.revokedAt) return "REVOKED";
  if (invite.expiresAt && invite.expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) return "USED_UP";
  return "VALID";
}

/** /katil/[kod] önizlemesi. Kod yoksa null. Üye listesi içermez. */
export async function previewInvite(rawCode: string, now = new Date()) {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  const invite = await db.clubInvite.findUnique({
    where: { code },
    select: {
      code: true,
      revokedAt: true,
      expiresAt: true,
      maxUses: true,
      usedCount: true,
      club: {
        select: {
          id: true,
          slug: true,
          name: true,
          shortDescTr: true,
          shortDescEn: true,
          logoKey: true,
          status: true,
          deletedAt: true,
          universityId: true,
          university: { select: { name: true } },
          category: { select: { nameTr: true, nameEn: true } },
          _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
        },
      },
    },
  });
  if (!invite || invite.club.deletedAt) return null;
  const state = invite.club.status !== "ACTIVE" ? ("REVOKED" as const) : inviteState(invite, now);
  return { code: invite.code, state, club: invite.club };
}

/** Engel hâlâ geçerli mi (süresiz engel = null bitiş). */
export function isBanActive(m: { status: string; bannedUntil: Date | null }, now: Date): boolean {
  return m.status === "BANNED" && (m.bannedUntil === null || m.bannedUntil.getTime() > now.getTime());
}

/**
 * Davet koduyla direkt üyelik (PRODUCT §4: onaysız). Aynı üniversite şartı; engelli üye katılamaz;
 * çıkarılmış (REMOVED) / ayrılmış üye tekrar katılabilir. Kullanım sayacı atomik artar.
 */
export async function joinWithInvite(actor: Actor, rawCode: string, via: "code" | "link" = "code"): Promise<{ clubId: string; slug: string }> {
  await enforceRateLimits([{ key: `club-join:user:${actor.id}`, limit: 30, windowSec: 3600 }]);
  const code = normalizeCode(rawCode);
  if (!code) throw fail("INVITE_INVALID", { code: "club.errors.inviteInvalid" });
  return db.$transaction(async (tx) => {
    const invite = await tx.clubInvite.findUnique({
      where: { code },
      select: { id: true, club: { select: { id: true, slug: true, universityId: true, status: true, deletedAt: true } } },
    });
    if (!invite || invite.club.deletedAt || invite.club.status !== "ACTIVE") throw fail("INVITE_INVALID", { code: "club.errors.inviteInvalid" });
    const { club } = invite;
    if (actor.universityId !== club.universityId) throw fail("OTHER_UNIVERSITY");
    const now = new Date();
    const existing = await tx.membership.findUnique({ where: { clubId_userId: { clubId: club.id, userId: actor.id } }, select: { status: true, bannedUntil: true } });
    if (existing?.status === "ACTIVE") throw fail("ALREADY_MEMBER");
    if (existing && isBanActive(existing, now)) throw fail("BANNED");
    const used = await tx.$executeRaw`
      UPDATE "ClubInvite" SET "usedCount" = "usedCount" + 1
      WHERE "id" = ${invite.id} AND "revokedAt" IS NULL
        AND ("expiresAt" IS NULL OR "expiresAt" > ${now})
        AND ("maxUses" IS NULL OR "usedCount" < "maxUses")`;
    if (used === 0) throw fail("INVITE_INVALID", { code: "club.errors.inviteInvalid" });
    await tx.membership.upsert({
      where: { clubId_userId: { clubId: club.id, userId: actor.id } },
      update: { status: "ACTIVE", joinedAt: now, leftAt: null, bannedUntil: null, joinedVia: via },
      create: { clubId: club.id, userId: actor.id, joinedVia: via },
    });
    await audit({ action: "club.member.joined", targetType: "Club", targetId: club.id, actorId: actor.id, universityId: club.universityId, meta: { inviteId: invite.id } }, tx);
    return { clubId: club.id, slug: club.slug };
  });
}

/** Kulüpten ayrıl. Başkan ayrılamaz (önce devretmeli); görevliyse görevliliği de biter. */
export async function leaveClub(actor: { id: string }, clubId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const club = await tx.club.findFirst({ where: { id: clubId, deletedAt: null }, select: { presidentId: true, universityId: true } });
    if (!club) throw fail("NOT_FOUND");
    if (club.presidentId === actor.id) throw fail("PRESIDENT_CANNOT_LEAVE");
    const { count } = await tx.membership.updateMany({ where: { clubId, userId: actor.id, status: "ACTIVE" }, data: { status: "LEFT", leftAt: new Date() } });
    if (count === 0) throw fail("NOT_MEMBER");
    await tx.staffAssignment.deleteMany({ where: { clubId, userId: actor.id } });
    await audit({ action: "club.member.left", targetType: "Club", targetId: clubId, actorId: actor.id, universityId: club.universityId }, tx);
  });
}

// ---------------------------------------------------------------- Onay handler'larının çağırdığı işlemler (tx)

async function assertRemovableMember(tx: Tx, clubId: string, userId: string) {
  const club = await tx.club.findFirst({ where: { id: clubId, deletedAt: null }, select: { presidentId: true } });
  if (!club) throw fail("NOT_FOUND");
  if (club.presidentId === userId) throw fail("IS_PRESIDENT");
  const m = await tx.membership.findUnique({ where: { clubId_userId: { clubId, userId } }, select: { status: true } });
  return m;
}

/** Talep oluştururken: hedef kulübün aktif üyesi ve başkan değil. */
export async function assertActiveNonPresidentMember(clubId: string, userId: string, client: Tx | typeof db = db): Promise<void> {
  const club = await client.club.findFirst({ where: { id: clubId, deletedAt: null }, select: { presidentId: true } });
  if (!club) throw fail("NOT_FOUND");
  if (club.presidentId === userId) throw fail("IS_PRESIDENT");
  const m = await client.membership.findUnique({ where: { clubId_userId: { clubId, userId } }, select: { status: true } });
  if (m?.status !== "ACTIVE") throw fail("NOT_MEMBER");
}

export async function removeMember(tx: Tx, clubId: string, userId: string): Promise<void> {
  const m = await assertRemovableMember(tx, clubId, userId);
  if (m?.status !== "ACTIVE") throw fail("NOT_MEMBER");
  await tx.membership.update({ where: { clubId_userId: { clubId, userId } }, data: { status: "REMOVED", leftAt: new Date() } });
  await tx.staffAssignment.deleteMany({ where: { clubId, userId } });
}

/** Engelle (aktif üye veya daha önce ayrılmış/çıkarılmış kişi). `until` null = süresiz. */
export async function banMember(tx: Tx, clubId: string, userId: string, until: Date | null): Promise<void> {
  const m = await assertRemovableMember(tx, clubId, userId);
  if (!m) throw fail("NOT_MEMBER");
  await tx.membership.update({ where: { clubId_userId: { clubId, userId } }, data: { status: "BANNED", bannedUntil: until, leftAt: new Date() } });
  await tx.staffAssignment.deleteMany({ where: { clubId, userId } });
}

/** Hesap silme: üyelikler LEFT, görevlilikler silinir (başkanlık kontrolü önceden yapılır). */
export async function detachUserFromClubs(tx: Tx, userId: string): Promise<void> {
  await tx.membership.updateMany({ where: { userId, status: "ACTIVE" }, data: { status: "LEFT", leftAt: new Date() } });
  await tx.staffAssignment.deleteMany({ where: { userId } });
}

// ---------------------------------------------------------------- Ekip (görevliler)

/** Ekip sayımı yarışını önler: kulüp satırını transaction boyunca kilitler. */
export async function lockClub(tx: Tx, clubId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "Club" WHERE "id" = ${clubId} FOR UPDATE`;
}

export async function listStaffUserIds(tx: Tx | typeof db, clubId: string): Promise<string[]> {
  return (await tx.staffAssignment.findMany({ where: { clubId }, select: { userId: true } })).map((s) => s.userId);
}

export async function getStaffAssignment(clubId: string, userId: string, client: Tx | typeof db = db) {
  return client.staffAssignment.findUnique({ where: { clubId_userId: { clubId, userId } }, select: { title: true, permissions: true } });
}

/** Görevli ata / güncelle (handler, kilit + sınır kontrolü çağıranda). Görevli aktif üye olmalı. */
export async function assignStaff(tx: Tx, clubId: string, userId: string, title: string, permissions: readonly StaffPermissionName[]): Promise<void> {
  await assertActiveNonPresidentMember(clubId, userId, tx);
  await tx.staffAssignment.upsert({
    where: { clubId_userId: { clubId, userId } },
    update: { title, permissions: [...permissions] },
    create: { clubId, userId, title, permissions: [...permissions] },
  });
}

export async function removeStaff(tx: Tx, clubId: string, userId: string): Promise<void> {
  const { count } = await tx.staffAssignment.deleteMany({ where: { clubId, userId } });
  if (count === 0) throw fail("NOT_STAFF");
}

// ---------------------------------------------------------------- Admin doğrudan işlemleri (talepsiz, audit'li)

async function assertClubInUniversity(tx: Tx, universityId: string, clubId: string) {
  const club = await tx.club.findFirst({ where: { id: clubId, universityId, deletedAt: null }, select: { id: true } });
  if (!club) throw fail("NOT_FOUND");
}

export async function adminRemoveMember(actor: { id: string }, universityId: string, clubId: string, userId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await assertClubInUniversity(tx, universityId, clubId);
    await removeMember(tx, clubId, userId);
    await audit({ action: "club.member.removedDirect", targetType: "Club", targetId: clubId, actorId: actor.id, universityId, meta: { userId } }, tx);
  });
}

export async function adminRemoveStaff(actor: { id: string }, universityId: string, clubId: string, userId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await assertClubInUniversity(tx, universityId, clubId);
    await removeStaff(tx, clubId, userId);
    await audit({ action: "club.staff.removedDirect", targetType: "Club", targetId: clubId, actorId: actor.id, universityId, meta: { userId } }, tx);
  });
}

/** F10 cron (deadline-reminder): kulübün aktif üyelerinin kullanıcı id'leri. */
export async function listActiveMemberIds(clubId: string): Promise<string[]> {
  const rows = await db.membership.findMany({ where: { clubId, status: "ACTIVE" }, select: { userId: true } });
  return rows.map((r) => r.userId);
}
