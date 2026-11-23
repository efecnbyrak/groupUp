import "server-only";

import { db } from "@/lib/db";
import type { Prisma } from "@/lib/db-types";
import { applyTranslatedBlocks, asRichDoc, collectTextBlocks } from "@/lib/rich-text";
import { getTranslator, translationHash } from "@/lib/translation";

/**
 * Yayın/güncelleme onayında TR → EN (EVENTS-FORMS-I18N §7.2). Kaynak özeti değişmediyse API
 * çağrılmaz; sağlayıcı kapalı/hatalıysa EN boş kalır (arayüz TR + "çeviri bekliyor").
 * Dönüş: çeviri yazıldı mı.
 */
export async function translateEvent(eventId: string): Promise<boolean> {
  const e = await db.event.findUnique({
    where: { id: eventId },
    select: { titleTr: true, summaryTr: true, descriptionTr: true, translationHash: true, titleEn: true, status: true },
  });
  if (!e || (e.status !== "PUBLISHED" && e.status !== "COMPLETED")) return false;
  const doc = asRichDoc(e.descriptionTr);
  const hash = translationHash({ t: e.titleTr, s: e.summaryTr, d: doc });
  if (hash === e.translationHash && e.titleEn) return false;
  const translator = getTranslator();
  const plain = await translator.translate({ texts: [e.titleTr, e.summaryTr], source: "tr", target: "en" });
  if (!plain) return false;
  const blocks = collectTextBlocks(doc);
  const html = blocks.length ? await translator.translate({ texts: blocks, html: true, source: "tr", target: "en" }) : [];
  if (!html) return false;
  // Yarışa karşı: çeviri sırasında kaynak değiştiyse yazma (sonraki onay tekrar çevirir).
  const { count } = await db.event.updateMany({
    where: { id: eventId, titleTr: e.titleTr, summaryTr: e.summaryTr },
    data: {
      titleEn: plain[0]!.slice(0, 200),
      summaryEn: plain[1]!.slice(0, 500),
      descriptionEn: applyTranslatedBlocks(doc, html) as unknown as Prisma.InputJsonValue,
      translationHash: hash,
      translatedAt: new Date(),
      enManual: false,
    },
  });
  return count > 0;
}

/** F10 cron: çevirisi eksik yayındaki etkinlikleri tekrar dener. */
export async function retryPendingEventTranslations(limit = 20): Promise<number> {
  const rows = await db.event.findMany({ where: { status: "PUBLISHED", titleEn: null }, select: { id: true }, take: limit, orderBy: { publishedAt: "asc" } });
  let done = 0;
  for (const r of rows) if (await translateEvent(r.id)) done++;
  return done;
}
