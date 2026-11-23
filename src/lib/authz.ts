import "server-only";

import { clubRoleOf, hasClubPermission, type ClubAccess, type ClubPermission, type StaffPermissionName } from "./club-roles";
import { db } from "./db";
import { getCurrentSession, type SessionUser } from "./session";

/**
 * Yetki kapıları — docs/ROLES-PERMISSIONS.md §2.
 * Her Server Action / Route Handler İLK satırda bunlardan birini çağırır.
 */

export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor(message = "Oturum gerekli") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "Bu işlem için yetkiniz yok") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export type { SessionUser };

/** Oturum varsa döner, yoksa null (doğrulanmamış/askıdaki hesaplar dahil). */
export function getSessionUser(): Promise<SessionUser | null> {
  return getCurrentSession();
}

/** ACTIVE + maili doğrulanmış kullanıcı. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentSession();
  if (!user) throw new UnauthorizedError();
  if (!user.emailVerified || user.status !== "ACTIVE") throw new ForbiddenError("Hesap aktif değil");
  return user;
}

/** Manuel mezun yolu: maili doğrulanmış, belge onayı bekleyen kullanıcı (AUTH-EMAIL §6). */
export async function requirePendingAlumni(): Promise<SessionUser> {
  const user = await getCurrentSession();
  if (!user) throw new UnauthorizedError();
  if (!user.emailVerified || user.status !== "PENDING_ALUMNI_REVIEW") throw new ForbiddenError();
  return user;
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.platformRole !== "SUPER_ADMIN") throw new ForbiddenError();
  return user;
}

/** Süper Admin her üniversitede yetkilidir. */
export async function requireUniversityAdmin(universityId: string): Promise<SessionUser> {
  const user = await requireUser();
  if (user.platformRole === "SUPER_ADMIN") return user;
  const admin = await db.universityAdmin.findUnique({
    where: { universityId_userId: { universityId, userId: user.id } },
    select: { id: true },
  });
  if (!admin) throw new ForbiddenError();
  return user;
}

/** Tenant izolasyonu: kullanıcı yalnızca kendi üniversitesinin verisine erişir. */
export function assertSameUniversity(user: SessionUser, universityId: string): void {
  if (user.platformRole === "SUPER_ADMIN") return;
  if (user.universityId !== universityId) throw new ForbiddenError();
}

/** Süper Admin veya o üniversitenin Admini (sayfa/servis içi kontroller için; hata fırlatmaz). */
export async function isUniversityAdmin(user: SessionUser, universityId: string): Promise<boolean> {
  if (user.platformRole === "SUPER_ADMIN") return true;
  const row = await db.universityAdmin.findUnique({ where: { universityId_userId: { universityId, userId: user.id } }, select: { id: true } });
  return row !== null;
}

/** Kullanıcının kulüpteki rolü/yetkileri + kulübün üniversitesi. Kulüp yoksa/silinmişse null. */
export async function getClubAccess(user: SessionUser, clubId: string): Promise<(ClubAccess & { universityId: string }) | null> {
  const club = await db.club.findFirst({
    where: { id: clubId, deletedAt: null },
    select: {
      universityId: true,
      presidentId: true,
      staff: { where: { userId: user.id }, select: { permissions: true } },
      memberships: { where: { userId: user.id, status: "ACTIVE" }, select: { id: true } },
    },
  });
  if (!club) return null;
  const sameUniversity = user.universityId === club.universityId;
  const staff = sameUniversity ? club.staff[0] : undefined;
  const role = sameUniversity
    ? clubRoleOf({
        isPresident: club.presidentId === user.id,
        staffPermissions: staff ? (staff.permissions as StaffPermissionName[]) : null,
        isActiveMember: club.memberships.length > 0,
      })
    : null;
  return {
    universityId: club.universityId,
    role,
    permissions: (staff?.permissions ?? []) as StaffPermissionName[],
    isAdmin: await isUniversityAdmin(user, club.universityId),
  };
}

/**
 * Kulüp yetkisi (ROLES-PERMISSIONS §2). "PRESIDENT" yalnızca başkana özel işlemler.
 * Üniversite Admini / Süper Admin her kulüp yetkisine sahiptir (doğrudan, audit'li).
 * `opts.allowAdmin: false` → yalnızca kulüp ekibi (ör. Başkan adına talep oluşturma).
 */
export async function requireClubPermission(clubId: string, permission: ClubPermission, opts: { allowAdmin?: boolean } = {}): Promise<SessionUser> {
  const user = await requireUser();
  const access = await getClubAccess(user, clubId);
  if (!access) throw new ForbiddenError();
  const effective = opts.allowAdmin === false ? { ...access, isAdmin: false } : access;
  if (!hasClubPermission(effective, permission)) throw new ForbiddenError();
  return user;
}

/** Kulübün aktif üyesi (başkan ve görevliler dahil). */
export async function requireClubMember(clubId: string): Promise<SessionUser> {
  const user = await requireUser();
  const access = await getClubAccess(user, clubId);
  if (!access?.role) throw new ForbiddenError();
  return user;
}
