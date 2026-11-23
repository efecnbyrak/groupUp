import "server-only";

import { signedAttachmentUrl } from "@/lib/attachments";
import { db } from "@/lib/db";
import type { ChangeRequestType } from "@/lib/db-types";

import type { DiffRow } from "./domain/diff";
import { handlers } from "./handlers";

export const QUEUE_PAGE_SIZE = 25;
const person = { id: true, email: true, profile: { select: { firstName: true, lastName: true, avatarKey: true } } } as const;
const USER_TARGET: readonly ChangeRequestType[] = ["MEMBER_REMOVE", "MEMBER_BAN", "STAFF_ASSIGN", "STAFF_REMOVE", "ALUMNI_VERIFY"];

/** Admin onay kuyruğu: üniversitenin PENDING talepleri, en eski önce. */
export async function listQueue(universityId: string, filter: { type?: ChangeRequestType; clubId?: string; cursor?: string } = {}) {
  const rows = await db.changeRequest.findMany({
    where: { universityId, status: "PENDING", ...(filter.type ? { type: filter.type } : {}), ...(filter.clubId ? { clubId: filter.clubId } : {}) },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: QUEUE_PAGE_SIZE + 1,
    ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    select: { id: true, type: true, createdAt: true, targetId: true, club: { select: { id: true, name: true } }, requestedBy: { select: person }, _count: { select: { attachments: true } } },
  });
  const hasMore = rows.length > QUEUE_PAGE_SIZE;
  const items = hasMore ? rows.slice(0, QUEUE_PAGE_SIZE) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]?.id : undefined };
}

export function pendingCount(universityId: string, type?: ChangeRequestType): Promise<number> {
  return db.changeRequest.count({ where: { universityId, status: "PENDING", ...(type ? { type } : {}) } });
}

/** Talep detayı — tenant kapsamlı (yalnızca o üniversite). Ekler 5 dk imzalı URL ile. */
export async function getRequestDetail(universityId: string, requestId: string) {
  const req = await db.changeRequest.findFirst({
    where: { id: requestId, universityId },
    select: {
      id: true,
      type: true,
      status: true,
      payload: true,
      reason: true,
      decisionNote: true,
      decidedAt: true,
      createdAt: true,
      targetId: true,
      reviewedById: true,
      club: { select: { id: true, name: true, slug: true } },
      requestedBy: { select: person },
      attachments: { orderBy: { createdAt: "asc" }, select: { id: true, fileName: true, mimeType: true, sizeBytes: true, storageKey: true } },
    },
  });
  if (!req) return null;
  const target = USER_TARGET.includes(req.type)
    ? await db.user.findUnique({ where: { id: req.targetId }, select: { ...person, profile: { select: { firstName: true, lastName: true, avatarKey: true, graduationYear: true, studentNo: true } } } })
    : null;
  let diff: DiffRow[] = [];
  try {
    diff = handlers.get(req.type).describe(req.payload);
  } catch {
    diff = [];
  }
  const { attachments, ...rest } = req;
  return { ...rest, target, diff, attachments: attachments.map(({ storageKey, ...a }) => ({ ...a, url: signedAttachmentUrl(storageKey) })) };
}

/** Kulüp paneli "Talepler": kulübün tüm talepleri, yeniden eskiye. */
export async function listClubRequests(clubId: string, cursor?: string) {
  const rows = await db.changeRequest.findMany({
    where: { clubId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: QUEUE_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, type: true, status: true, payload: true, reason: true, decisionNote: true, decidedAt: true, createdAt: true, targetId: true, requestedBy: { select: person } },
  });
  const hasMore = rows.length > QUEUE_PAGE_SIZE;
  const items = hasMore ? rows.slice(0, QUEUE_PAGE_SIZE) : rows;
  const targetIds = [...new Set(items.filter((r) => USER_TARGET.includes(r.type)).map((r) => r.targetId))];
  const targets = new Map((await db.user.findMany({ where: { id: { in: targetIds } }, select: person })).map((u) => [u.id, u]));
  return {
    items: items.map((r) => {
      let diff: DiffRow[] = [];
      try {
        diff = handlers.get(r.type).describe(r.payload);
      } catch {
        diff = [];
      }
      return { ...r, target: targets.get(r.targetId) ?? null, diff };
    }),
    nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
  };
}

/** Kulübün bekleyen talep hedefleri (UI'da "talep bekliyor" rozeti). */
export async function pendingTargetsForClub(clubId: string): Promise<{ id: string; type: ChangeRequestType; targetId: string }[]> {
  return db.changeRequest.findMany({ where: { clubId, status: "PENDING" }, select: { id: true, type: true, targetId: true } });
}

/** Mezun başvurusu son talebin ekleri (kullanıcının kendi ekranı). */
export async function getAlumniRequestFiles(userId: string) {
  const req = await db.changeRequest.findFirst({
    where: { type: "ALUMNI_VERIFY", targetId: userId },
    orderBy: { createdAt: "desc" },
    select: { status: true, createdAt: true, attachments: { select: { fileName: true } } },
  });
  return req ? { status: req.status, createdAt: req.createdAt, fileNames: req.attachments.map((a) => a.fileName) } : null;
}
