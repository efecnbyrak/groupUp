import "server-only";

import { db } from "@/lib/db";
import type { Prisma } from "@/lib/db-types";

import { contentOf } from "./events";
import { registrationState } from "./rules";

export const EVENT_PAGE_SIZE = 18;

const cardSelect = {
  id: true,
  status: true,
  titleTr: true,
  titleEn: true,
  summaryTr: true,
  summaryEn: true,
  coverKey: true,
  locationName: true,
  isOnline: true,
  startAt: true,
  endAt: true,
  applyOpensAt: true,
  applyClosesAt: true,
  capacity: true,
  waitlistEnabled: true,
  mode: true,
  club: { select: { id: true, slug: true, name: true, logoKey: true } },
  category: { select: { id: true, nameTr: true, nameEn: true } },
} as const satisfies Prisma.EventSelect;

export type EventCardData = Prisma.EventGetPayload<{ select: typeof cardSelect }>;

/** Kulüp paneli listesi: tüm durumlar, yeniden eskiye. */
export function listClubEvents(clubId: string) {
  return db.event.findMany({
    where: { clubId },
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
    select: { ...cardSelect, updatedAt: true },
  });
}

/** Sihirbaz: etkinlik içeriği + durum (kulüp kapsamlı). */
export async function getEventForEditor(clubId: string, eventId: string) {
  const e = await db.event.findFirst({
    where: { id: eventId, clubId },
    select: {
      id: true,
      status: true,
      universityId: true,
      publishedAt: true,
      categoryId: true,
      titleTr: true,
      summaryTr: true,
      descriptionTr: true,
      coverKey: true,
      locationName: true,
      locationAddress: true,
      mapUrl: true,
      isOnline: true,
      onlineUrl: true,
      startAt: true,
      endAt: true,
      applyOpensAt: true,
      applyClosesAt: true,
      capacity: true,
      waitlistEnabled: true,
      autoPromoteWaitlist: true,
      autoAccept: true,
      mode: true,
      teamMinSize: true,
      teamMaxSize: true,
      eligibility: true,
      images: { orderBy: { order: "asc" }, select: { key: true, alt: true } },
    },
  });
  if (!e) return null;
  return { id: e.id, status: e.status, universityId: e.universityId, content: contentOf({ ...e, clubId }) };
}

/** Etkinlik detay sayfası (görünürlük kararı sayfada: yayındaki herkese, diğerleri kulüp ekibi/Admin). */
export function getEventDetail(eventId: string) {
  return db.event.findUnique({
    where: { id: eventId },
    select: {
      ...cardSelect,
      universityId: true,
      descriptionTr: true,
      descriptionEn: true,
      locationAddress: true,
      mapUrl: true,
      onlineUrl: true,
      autoAccept: true,
      teamMinSize: true,
      teamMaxSize: true,
      eligibility: true,
      publishedAt: true,
      club: { select: { id: true, slug: true, name: true, logoKey: true, deletedAt: true } },
      images: { orderBy: { order: "asc" }, select: { key: true, alt: true } },
    },
  });
}

const visible = { status: "PUBLISHED" as const, club: { deletedAt: null, status: "ACTIVE" as const } };

/**
 * Feed (§8): kulüplerimin yaklaşan/süren etkinlikleri. Sıra: başvurusu açık ve deadline'ı yakın →
 * yaklaşanlar (başlangıca göre).
 */
export async function listFeedEvents(userId: string, universityId: string, now: Date) {
  const rows = await db.event.findMany({
    where: { ...visible, universityId, endAt: { gt: now }, club: { ...visible.club, memberships: { some: { userId, status: "ACTIVE" } } } },
    orderBy: [{ startAt: "asc" }, { id: "asc" }],
    take: 60,
    select: cardSelect,
  });
  const open = (e: EventCardData) => {
    const s = registrationState(e, now);
    return s === "OPEN" || s === "CLOSING_SOON" || s === "WAITLIST";
  };
  const openRows = rows.filter(open).sort((a, b) => (a.applyClosesAt?.getTime() ?? 0) - (b.applyClosesAt?.getTime() ?? 0));
  return [...openRows, ...rows.filter((e) => !open(e))];
}

export interface ExploreFilter {
  categoryId?: string;
  q?: string;
  from?: Date;
  to?: Date;
  openOnly?: boolean;
  cursor?: string;
}

/** Keşfet: üniversitenin yayındaki etkinlikleri (bitmemiş), başlangıca göre, cursor. */
export async function listExploreEvents(universityId: string, now: Date, f: ExploreFilter = {}) {
  const q = f.q?.trim();
  const where: Prisma.EventWhereInput = {
    ...visible,
    universityId,
    endAt: { gt: now },
    ...(f.categoryId ? { OR: [{ categoryId: f.categoryId }, { category: { parentId: f.categoryId } }] } : {}),
    ...(f.from || f.to ? { startAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } } : {}),
    ...(f.openOnly ? { applyOpensAt: { lte: now }, applyClosesAt: { gt: now } } : {}),
    ...(q
      ? {
          AND: [
            {
              OR: [
                { titleTr: { contains: q, mode: "insensitive" } },
                { titleEn: { contains: q, mode: "insensitive" } },
                { club: { name: { contains: q, mode: "insensitive" } } },
              ],
            },
          ],
        }
      : {}),
  };
  const rows = await db.event.findMany({
    where,
    orderBy: [{ startAt: "asc" }, { id: "asc" }],
    take: EVENT_PAGE_SIZE + 1,
    ...(f.cursor ? { cursor: { id: f.cursor }, skip: 1 } : {}),
    select: cardSelect,
  });
  const hasMore = rows.length > EVENT_PAGE_SIZE;
  const items = hasMore ? rows.slice(0, EVENT_PAGE_SIZE) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]?.id : undefined };
}

/** Public kulüp sayfası: yayındaki yaklaşan etkinlikler. */
export function listClubPublicEvents(clubId: string, now: Date) {
  return db.event.findMany({
    where: { clubId, status: "PUBLISHED", endAt: { gt: now } },
    orderBy: [{ startAt: "asc" }],
    take: 12,
    select: cardSelect,
  });
}

// ---------------------------------------------------------------- Duyurular

const announcementSelect = {
  id: true,
  titleTr: true,
  titleEn: true,
  bodyTr: true,
  bodyEn: true,
  pinned: true,
  createdAt: true,
  club: { select: { id: true, slug: true, name: true, logoKey: true } },
} as const satisfies Prisma.AnnouncementSelect;

export function listClubAnnouncements(clubId: string, take = 30) {
  return db.announcement.findMany({ where: { clubId }, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take, select: announcementSelect });
}

/** Feed: üyesi olduğum kulüplerin son duyuruları. */
export function listFeedAnnouncements(userId: string, take = 5) {
  return db.announcement.findMany({
    where: { club: { deletedAt: null, memberships: { some: { userId, status: "ACTIVE" } } } },
    orderBy: [{ createdAt: "desc" }],
    take,
    select: announcementSelect,
  });
}
