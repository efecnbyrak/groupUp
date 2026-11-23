import "server-only";

import { audit } from "@/lib/audit";
import { randomToken, sha256 } from "@/lib/crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hashPassword, verifyPassword } from "@/lib/password";
import { enforceRateLimits } from "@/lib/rate-limit";
import { getStorage } from "@/lib/storage";
import { sendEmailSafe } from "@/modules/notification";
import { detachUserFromClubs, isClubPresident } from "@/modules/club";
import { anonymizeProfileForDeletion } from "@/modules/profile";
import { revokeAdminRolesForUser } from "@/modules/university";

import { displayName, fail, limits } from "./service";
import { describeUserAgent, type DeviceSummary } from "./user-agent";

/** Aktif oturumlar ve hesap silme — AUTH-EMAIL §4, §8. */

export interface SessionRow {
  id: string;
  device: DeviceSummary;
  createdAt: Date;
  lastSeenAt: Date;
  current: boolean;
}

/** Kullanıcının süresi dolmamış oturumları (en son görülen önce). */
export async function listSessions(userId: string, currentSessionId: string, now: Date): Promise<SessionRow[]> {
  const rows = await db.session.findMany({
    where: { userId, expiresAt: { gt: now } },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, userAgent: true, createdAt: true, lastSeenAt: true },
  });
  return rows.map((r) => ({ id: r.id, device: describeUserAgent(r.userAgent), createdAt: r.createdAt, lastSeenAt: r.lastSeenAt, current: r.id === currentSessionId }));
}

/** Yalnızca kendi oturumunu kapatabilir (başkasınınki "bulunamadı"). */
export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  const { count } = await db.session.deleteMany({ where: { id: sessionId, userId } });
  if (count === 0) throw fail("NOT_FOUND");
  await audit({ action: "identity.session.revoked", targetType: "Session", targetId: sessionId, actorId: userId });
}

// ---------------------------------------------------------------- Hesap silme

const DELETE_TTL_MS = 30 * 60 * 1000;

/**
 * Adım 1: şifre doğrulanır → 30 dk'lık tek kullanımlık link (DELETE_ACCOUNT) maile gider.
 * Son Süper Admin hesabı silinemez. Kulüp başkanı önce başkanlığı devretmelidir (Admin'e başvurur).
 */
export async function requestAccountDeletion(actor: { id: string }, password: string): Promise<void> {
  await enforceRateLimits(limits.accountUser(actor.id));
  const user = await db.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { email: true, passwordHash: true, platformRole: true, locale: true, profile: { select: { firstName: true } } },
  });
  if (!(await verifyPassword(user.passwordHash, password))) throw fail("WRONG_PASSWORD", { password: "auth.security.wrongPassword" });
  if (user.platformRole === "SUPER_ADMIN") {
    const others = await db.user.count({ where: { platformRole: "SUPER_ADMIN", status: "ACTIVE", id: { not: actor.id } } });
    if (others === 0) throw fail("LAST_SUPER_ADMIN");
  }
  if (await isClubPresident(actor.id)) throw fail("PRESIDENT_MUST_TRANSFER");
  const token = randomToken();
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.emailToken.updateMany({ where: { userId: actor.id, purpose: "DELETE_ACCOUNT", usedAt: null }, data: { usedAt: now } });
    await tx.emailToken.create({
      data: { userId: actor.id, email: user.email, purpose: "DELETE_ACCOUNT", codeHash: sha256(token), expiresAt: new Date(now.getTime() + DELETE_TTL_MS) },
    });
    await audit({ action: "identity.account.deletionRequested", targetType: "User", targetId: actor.id, actorId: actor.id }, tx);
  });
  const url = `${env.APP_URL}/hesap/sil/onay?token=${encodeURIComponent(token)}`;
  await sendEmailSafe(user.email, "delete-account", user.locale, { name: displayName(user.profile, user.email), url });
}

async function findDeleteToken(token: string) {
  const row = await db.emailToken.findFirst({
    where: { codeHash: sha256(token), purpose: "DELETE_ACCOUNT", usedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, userId: true, email: true },
  });
  return row?.userId ? row : null;
}

export async function isDeleteTokenValid(token: string): Promise<boolean> {
  return (await findDeleteToken(token)) !== null;
}

/**
 * Adım 2 (linkten): kişisel veriler anonimleştirilir — User (e-posta, şifre, durum),
 * Profile (profile modülü), Admin rolleri (university modülü); oturumlar/tokenlar silinir.
 * Kayıt fiziksel olarak silinmez (audit ve ileride üyelik/başvuru geçmişi bütünlüğü için).
 */
export async function confirmAccountDeletion(token: string): Promise<void> {
  const row = await findDeleteToken(token);
  if (!row?.userId) throw fail("DELETE_TOKEN_INVALID");
  const userId = row.userId;
  const passwordHash = await hashPassword(randomToken());
  const files = await db.$transaction(async (tx) => {
    const used = await tx.emailToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
    if (used.count !== 1) throw fail("DELETE_TOKEN_INVALID");
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, universityId: true, status: true } });
    if (user.status === "DELETED" || user.email !== row.email) throw fail("DELETE_TOKEN_INVALID");
    await tx.user.update({
      where: { id: userId },
      data: { email: `deleted+${userId}@deleted.invalid`, passwordHash, status: "DELETED", deletedAt: new Date(), platformRole: "USER" },
    });
    if (await isClubPresident(userId, tx)) throw fail("PRESIDENT_MUST_TRANSFER");
    const removed = await anonymizeProfileForDeletion(tx, userId);
    await detachUserFromClubs(tx, userId);
    await revokeAdminRolesForUser(tx, userId);
    await tx.session.deleteMany({ where: { userId } });
    await tx.emailToken.deleteMany({ where: { userId } });
    await audit({ action: "identity.account.deleted", targetType: "User", targetId: userId, actorId: userId, universityId: user.universityId }, tx);
    return removed;
  });
  const storage = getStorage();
  await Promise.all([...files.publicKeys.map((k) => storage.delete(k, "public")), ...files.privateKeys.map((k) => storage.delete(k, "private"))]);
}
