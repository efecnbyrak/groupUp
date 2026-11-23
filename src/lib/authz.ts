import "server-only";

import { db } from "./db";
import { getCurrentSession, type SessionUser } from "./session";

/**
 * Yetki kapıları — docs/ROLES-PERMISSIONS.md §2.
 * Her Server Action / Route Handler İLK satırda bunlardan birini çağırır.
 * requireClubPermission / requireClubMember kulüp tablolarıyla F5'te eklenir.
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
