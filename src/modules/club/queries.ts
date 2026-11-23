import "server-only";

import type { ClubRole } from "@/lib/club-roles";
import { db } from "@/lib/db";

/** Okuma fonksiyonları — her biri universityId veya kulüp kimliğiyle kapsamlanır. */
export const CLUB_PAGE_SIZE = 24;
export const MEMBER_PAGE_SIZE = 30;

const personSelect = { id: true, email: true, profile: { select: { firstName: true, lastName: true, avatarKey: true, studentNo: true } } } as const;

export function personName(p: { email: string; profile: { firstName: string; lastName: string } | null } | null | undefined): string {
  if (!p) return "—";
  return [p.profile?.firstName, p.profile?.lastName].filter(Boolean).join(" ") || p.email;
}

const cardSelect = {
  id: true,
  slug: true,
  name: true,
  shortDescTr: true,
  shortDescEn: true,
  logoKey: true,
  coverKey: true,
  category: { select: { id: true, slug: true, nameTr: true, nameEn: true, icon: true } },
  _count: { select: { memberships: { where: { status: "ACTIVE" as const } } } },
} as const;

/** Keşfet / kulüp dizini: kendi üniversitesinin aktif kulüpleri (ad sırası, cursor). */
export async function listClubs(universityId: string, filter: { categoryId?: string; q?: string; cursor?: string } = {}) {
  const q = filter.q?.trim();
  const rows = await db.club.findMany({
    where: {
      universityId,
      deletedAt: null,
      status: "ACTIVE",
      ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { shortDescTr: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: CLUB_PAGE_SIZE + 1,
    ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    select: cardSelect,
  });
  const hasMore = rows.length > CLUB_PAGE_SIZE;
  const items = hasMore ? rows.slice(0, CLUB_PAGE_SIZE) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]?.id : undefined };
}

export type ClubCardData = Awaited<ReturnType<typeof listClubs>>["items"][number];

/** Header "Kulüplerim" + /kulupler: aktif üyelikler, rolüm ve başkan adı. */
export async function listMyClubs(userId: string): Promise<{ club: ClubCardData & { presidentName: string }; role: ClubRole }[]> {
  const rows = await db.membership.findMany({
    where: { userId, status: "ACTIVE", club: { deletedAt: null } },
    orderBy: { joinedAt: "asc" },
    take: 50,
    select: { club: { select: { ...cardSelect, presidentId: true, president: { select: personSelect }, staff: { where: { userId }, select: { id: true } } } } },
  });
  return rows.map(({ club }) => {
    const { president, staff, presidentId, ...rest } = club;
    const role: ClubRole = presidentId === userId ? "PRESIDENT" : staff.length ? "STAFF" : "MEMBER";
    return { club: { ...rest, presidentName: personName(president) }, role };
  });
}

/** Public kulüp sayfası (/kulupler/[slug]) — üye listesi YOK. */
export function getClubPublic(slug: string) {
  return db.club.findFirst({
    where: { slug, deletedAt: null, status: "ACTIVE" },
    select: {
      ...cardSelect,
      universityId: true,
      descriptionTr: true,
      descriptionEn: true,
      contactEmail: true,
      instagram: true,
      createdAt: true,
      university: { select: { name: true } },
      president: { select: { profile: { select: { firstName: true, lastName: true, avatarKey: true } } } },
    },
  });
}

/** Panel kapısı için: kulübün kimliği ve üniversitesi (slug genel benzersiz). */
export function findClubBySlug(slug: string) {
  return db.club.findFirst({ where: { slug, deletedAt: null }, select: { id: true, slug: true, name: true, universityId: true, logoKey: true, presidentId: true, status: true } });
}

export async function getMembership(clubId: string, userId: string) {
  return db.membership.findUnique({ where: { clubId_userId: { clubId, userId } }, select: { status: true, bannedUntil: true, joinedAt: true } });
}

/** Kulüp paneli: üyeler (aktif), görevli unvanı ile. */
export async function listMembers(clubId: string, filter: { q?: string; cursor?: string } = {}) {
  const q = filter.q?.trim();
  const rows = await db.membership.findMany({
    where: {
      clubId,
      status: "ACTIVE",
      ...(q
        ? {
            user: {
              OR: [
                { email: { contains: q, mode: "insensitive" } },
                { profile: { firstName: { contains: q, mode: "insensitive" } } },
                { profile: { lastName: { contains: q, mode: "insensitive" } } },
              ],
            },
          }
        : {}),
    },
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
    take: MEMBER_PAGE_SIZE + 1,
    ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      joinedAt: true,
      joinedVia: true,
      user: { select: { ...personSelect, type: true, staffRoles: { where: { clubId }, select: { title: true } } } },
    },
  });
  const hasMore = rows.length > MEMBER_PAGE_SIZE;
  const items = hasMore ? rows.slice(0, MEMBER_PAGE_SIZE) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]?.id : undefined };
}

export function listStaff(clubId: string) {
  return db.staffAssignment.findMany({
    where: { clubId },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, permissions: true, createdAt: true, user: { select: personSelect } },
  });
}

/** Ekip atamaya aday: aktif üye, başkan değil, görevli değil. */
export function listStaffCandidates(clubId: string, presidentId: string | null) {
  return db.membership.findMany({
    where: { clubId, status: "ACTIVE", ...(presidentId ? { userId: { not: presidentId } } : {}), user: { staffRoles: { none: { clubId } } } },
    orderBy: { joinedAt: "asc" },
    take: 500,
    select: { user: { select: personSelect } },
  });
}

export function listInvites(clubId: string) {
  return db.clubInvite.findMany({
    where: { clubId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, code: true, maxUses: true, usedCount: true, expiresAt: true, revokedAt: true, createdAt: true },
  });
}

export async function clubOverview(clubId: string) {
  const [members, staff, invites, joinedLast30] = await Promise.all([
    db.membership.count({ where: { clubId, status: "ACTIVE" } }),
    db.staffAssignment.count({ where: { clubId } }),
    db.clubInvite.count({ where: { clubId, revokedAt: null } }),
    db.membership.count({ where: { clubId, status: "ACTIVE", joinedAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } } }),
  ]);
  return { members, staff, invites, joinedLast30 };
}

/** Admin: üniversitenin kulüpleri (başkan + üye sayısı). */
export async function listClubsForAdmin(universityId: string, cursor?: string) {
  const rows = await db.club.findMany({
    where: { universityId, deletedAt: null },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: CLUB_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { ...cardSelect, status: true, createdAt: true, president: { select: personSelect } },
  });
  const hasMore = rows.length > CLUB_PAGE_SIZE;
  const items = hasMore ? rows.slice(0, CLUB_PAGE_SIZE) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]?.id : undefined };
}

export function getClubForAdmin(universityId: string, clubId: string) {
  return db.club.findFirst({
    where: { id: clubId, universityId, deletedAt: null },
    select: {
      ...cardSelect,
      status: true,
      descriptionTr: true,
      contactEmail: true,
      instagram: true,
      createdAt: true,
      presidentId: true,
      president: { select: personSelect },
    },
  });
}

/** Kategoriler + her birindeki aktif kulüp sayısı (Keşfet filtresi). */
export function listCategoriesWithCounts(universityId: string) {
  return db.clubCategory.findMany({
    orderBy: [{ order: "asc" }, { nameTr: "asc" }],
    select: { id: true, slug: true, nameTr: true, nameEn: true, icon: true, _count: { select: { clubs: { where: { universityId, deletedAt: null, status: "ACTIVE" } } } } },
  });
}
