import "server-only";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/db-types";
import { applyTranslatedBlocks, asRichDoc, collectTextBlocks, type RichDoc } from "@/lib/rich-text";
import { getTranslator, translationHash } from "@/lib/translation";

import { fail } from "./service";

/** Düz metin → paragraflı doc (boş satır = yeni paragraf, tek satır sonu = hardBreak). */
export function announcementDoc(text: string): RichDoc {
  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    type: "doc",
    content: paragraphs.map((p) => ({
      type: "paragraph" as const,
      content: p.split("\n").flatMap((line, i) => (i === 0 ? [{ type: "text" as const, text: line }] : [{ type: "hardBreak" as const }, { type: "text" as const, text: line }])),
    })),
  };
}

/** Duyuru yayınla (onaysız — ANNOUNCEMENT_POST). Çeviri yayından sonra, hata yutulur. */
export async function createAnnouncement(actor: { id: string }, clubId: string, input: { titleTr: string; body: string; pinned: boolean }): Promise<string> {
  const club = await db.club.findFirst({ where: { id: clubId, deletedAt: null }, select: { universityId: true } });
  if (!club) throw fail("NOT_FOUND");
  const body = announcementDoc(input.body);
  const row = await db.$transaction(async (tx) => {
    const a = await tx.announcement.create({
      data: { clubId, authorId: actor.id, titleTr: input.titleTr, bodyTr: body as unknown as Prisma.InputJsonValue, pinned: input.pinned },
      select: { id: true },
    });
    await audit({ action: "event.announcement.created", targetType: "Announcement", targetId: a.id, actorId: actor.id, universityId: club.universityId, meta: { clubId } }, tx);
    return a;
  });
  await translateAnnouncement(row.id).catch((err: unknown) => console.error("[translation] announcement", err));
  return row.id;
}

export async function deleteAnnouncement(actor: { id: string }, clubId: string, id: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const a = await tx.announcement.findFirst({ where: { id, clubId }, select: { club: { select: { universityId: true } } } });
    if (!a) throw fail("NOT_FOUND");
    await tx.announcement.delete({ where: { id } });
    await audit({ action: "event.announcement.deleted", targetType: "Announcement", targetId: id, actorId: actor.id, universityId: a.club.universityId, meta: { clubId } }, tx);
  });
}

export async function translateAnnouncement(id: string): Promise<boolean> {
  const a = await db.announcement.findUnique({ where: { id }, select: { titleTr: true, bodyTr: true, translationHash: true, titleEn: true } });
  if (!a) return false;
  const doc = asRichDoc(a.bodyTr);
  const hash = translationHash({ t: a.titleTr, d: doc });
  if (hash === a.translationHash && a.titleEn) return false;
  const t = getTranslator();
  const title = await t.translate({ texts: [a.titleTr], source: "tr", target: "en" });
  if (!title) return false;
  const blocks = collectTextBlocks(doc);
  const html = blocks.length ? await t.translate({ texts: blocks, html: true, source: "tr", target: "en" }) : [];
  if (!html) return false;
  await db.announcement.update({ where: { id }, data: { titleEn: title[0], bodyEn: applyTranslatedBlocks(doc, html) as unknown as Prisma.InputJsonValue, translationHash: hash } });
  return true;
}
