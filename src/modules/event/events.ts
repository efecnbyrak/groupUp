import "server-only";

import { audit } from "@/lib/audit";
import { randomToken } from "@/lib/crypto";
import { db, type Tx } from "@/lib/db";
import type { Prisma } from "@/lib/db-types";
import { detectFileType, MB } from "@/lib/file-type";
import { toContentWebp, toEventCoverWebp } from "@/lib/images";
import { asRichDoc, docToPlainText, EMPTY_DOC } from "@/lib/rich-text/doc";
import { slugify } from "@/lib/slug";
import { getStorage, newFileKey } from "@/lib/storage";

import { submitProblems, variantKey } from "./rules";
import type { EventContent } from "./schemas";
import { fail } from "./service";

interface Actor {
  id: string;
}

export const EVENT_IMAGE_MAX_BYTES = 10 * MB;

const contentSelect = {
  id: true,
  clubId: true,
  universityId: true,
  status: true,
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
} as const satisfies Prisma.EventSelect;

type ContentRow = Prisma.EventGetPayload<{ select: typeof contentSelect }>;

/** DB satırı → sihirbaz içeriği (EVENT_UPDATE "before" ve editör başlangıcı). */
export function contentOf(e: ContentRow): EventContent {
  return {
    categoryId: e.categoryId,
    titleTr: e.titleTr,
    summaryTr: e.summaryTr,
    descriptionTr: asRichDoc(e.descriptionTr),
    coverKey: e.coverKey,
    images: e.images.map((i) => ({ key: i.key, alt: i.alt })),
    locationName: e.locationName,
    locationAddress: e.locationAddress,
    mapUrl: e.mapUrl,
    isOnline: e.isOnline,
    onlineUrl: e.onlineUrl,
    startAt: e.startAt,
    endAt: e.endAt,
    applyOpensAt: e.applyOpensAt,
    applyClosesAt: e.applyClosesAt,
    capacity: e.capacity,
    waitlistEnabled: e.waitlistEnabled,
    autoPromoteWaitlist: e.autoPromoteWaitlist,
    autoAccept: e.autoAccept,
    mode: e.mode,
    teamMinSize: e.teamMinSize,
    teamMaxSize: e.teamMaxSize,
    eligibility: e.eligibility,
  };
}

/** Kulübe ait etkinlik (tenant + kulüp kapsamı). */
async function loadInClub(client: Tx | typeof db, clubId: string, eventId: string): Promise<ContentRow> {
  const e = await client.event.findFirst({ where: { id: eventId, clubId, club: { deletedAt: null } }, select: contentSelect });
  if (!e) throw fail("NOT_FOUND");
  return e;
}

export async function getEventContent(clubId: string, eventId: string): Promise<{ status: string; universityId: string; content: EventContent }> {
  const e = await loadInClub(db, clubId, eventId);
  return { status: e.status, universityId: e.universityId, content: contentOf(e) };
}

/** Anahtarlar bu etkinliğin klasöründe olmalı (başka etkinliğin/kulübün dosyası bağlanamaz). */
function assertOwnKeys(eventId: string, content: Partial<EventContent>): void {
  const prefix = `events/${eventId}/`;
  const keys = [content.coverKey, ...(content.images ?? []).map((i) => i.key)].filter((k): k is string => Boolean(k));
  if (keys.some((k) => !k.startsWith(prefix))) throw fail("FILE_INVALID");
  if (content.descriptionTr) {
    const walk = (nodes: readonly unknown[]): boolean =>
      nodes.every((n) => {
        if (!n || typeof n !== "object") return true;
        const node = n as { type?: string; attrs?: { src?: string }; content?: unknown[] };
        if (node.type === "image" && node.attrs?.src?.startsWith("/api/files/") && !node.attrs.src.startsWith(`/api/files/${prefix}`)) return false;
        return Array.isArray(node.content) ? walk(node.content) : true;
      });
    if (!walk(content.descriptionTr.content)) throw fail("FILE_INVALID");
  }
}

async function assertCategory(client: Tx | typeof db, categoryId: string): Promise<boolean> {
  const c = await client.eventCategory.findUnique({ where: { id: categoryId }, select: { _count: { select: { children: true } } } });
  if (!c) throw fail("NOT_FOUND", { categoryId: "validation.required" });
  return c._count.children === 0;
}

/** Content → Prisma veri alanları (görseller hariç). */
function eventData(c: Partial<EventContent>): Prisma.EventUncheckedUpdateInput {
  const { images: _i, descriptionTr, ...rest } = c;
  return { ...rest, ...(descriptionTr ? { descriptionTr: descriptionTr as unknown as Prisma.InputJsonValue } : {}) };
}

async function replaceImages(tx: Tx, eventId: string, images: EventContent["images"]): Promise<void> {
  await tx.eventImage.deleteMany({ where: { eventId } });
  if (images.length) await tx.eventImage.createMany({ data: images.map((img, order) => ({ eventId, key: img.key, alt: img.alt, order })) });
}

/** Yeni taslak (adım 1'in asgarisi: kategori + başlık). */
export async function createEventDraft(actor: Actor, clubId: string, input: { categoryId: string; titleTr: string }): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const club = await tx.club.findFirst({ where: { id: clubId, deletedAt: null, status: "ACTIVE" }, select: { universityId: true } });
    if (!club) throw fail("NOT_FOUND");
    await assertCategory(tx, input.categoryId);
    const slug = `${slugify(input.titleTr, 60) || "etkinlik"}-${randomToken(4).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6)}`;
    const e = await tx.event.create({
      data: {
        universityId: club.universityId,
        clubId,
        categoryId: input.categoryId,
        slug,
        titleTr: input.titleTr,
        summaryTr: "",
        descriptionTr: EMPTY_DOC as unknown as Prisma.InputJsonValue,
        createdById: actor.id,
      },
      select: { id: true },
    });
    await audit({ action: "event.event.created", targetType: "Event", targetId: e.id, actorId: actor.id, universityId: club.universityId, meta: { clubId } }, tx);
    return e;
  });
}

/** Otomatik taslak kaydı — yalnızca DRAFT (onay bekleyen/yayındaki içerik doğrudan değişmez). */
export async function saveEventDraft(clubId: string, eventId: string, content: EventContent): Promise<void> {
  assertOwnKeys(eventId, content);
  await db.$transaction(async (tx) => {
    const e = await loadInClub(tx, clubId, eventId);
    if (e.status !== "DRAFT") throw fail("NOT_EDITABLE");
    await assertCategory(tx, content.categoryId);
    await tx.event.update({ where: { id: eventId }, data: eventData(content) });
    await replaceImages(tx, eventId, content.images);
  });
}

export async function deleteEventDraft(actor: Actor, clubId: string, eventId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const e = await loadInClub(tx, clubId, eventId);
    if (e.status !== "DRAFT") throw fail("NOT_EDITABLE");
    await tx.event.delete({ where: { id: eventId } });
    await audit({ action: "event.event.deleted", targetType: "Event", targetId: eventId, actorId: actor.id, universityId: e.universityId, meta: { clubId } }, tx);
  });
}

/** Görsel yükle (magic byte + sharp WebP). Kapakta 400w varyantı da yazılır. Dönüş: public anahtar. */
export async function storeEventImage(clubId: string, eventId: string, kind: "cover" | "gallery" | "inline", file: Buffer): Promise<string> {
  const e = await loadInClub(db, clubId, eventId);
  if (e.status === "CANCELLED" || e.status === "COMPLETED") throw fail("NOT_EDITABLE");
  if (file.byteLength === 0) throw fail("FILE_INVALID");
  if (file.byteLength > EVENT_IMAGE_MAX_BYTES) throw fail("FILE_TOO_LARGE");
  const type = detectFileType(file);
  if (!type || type.ext === "pdf") throw fail("FILE_TYPE");
  const key = newFileKey("events", eventId, "webp");
  const storage = getStorage();
  try {
    if (kind === "cover") {
      const { large, small } = await toEventCoverWebp(file);
      await storage.put(key, large, "public");
      await storage.put(variantKey(key, 400), small, "public");
    } else {
      await storage.put(key, await toContentWebp(file), "public");
    }
  } catch {
    throw fail("FILE_INVALID");
  }
  return key;
}

// ---------------------------------------------------------------- Onay motoru (approval handler'ları çağırır)

/** EVENT_PUBLISH talebi: etkinlik kulüpte, DRAFT ve yayın şartlarını sağlıyor. */
export async function assertPublishable(tx: Tx, clubId: string, eventId: string, now: Date): Promise<void> {
  const e = await loadInClub(tx, clubId, eventId);
  if (e.status !== "DRAFT") throw fail("NOT_EDITABLE");
  const problems = submitProblems({ ...contentOf(e), categoryIsLeaf: await assertCategory(tx, e.categoryId) }, now);
  if (Object.keys(problems).length) throw fail("INCOMPLETE", problems);
}

/** EVENT_UPDATE: yalnızca yayındaki etkinlik; değişiklik geçerli mi (görseller bu etkinliğin mi, sonuç gönderilebilir mi). */
export async function assertUpdatable(tx: Tx, clubId: string, eventId: string, after: Partial<EventContent>, now: Date): Promise<void> {
  assertOwnKeys(eventId, after);
  const e = await loadInClub(tx, clubId, eventId);
  if (e.status !== "PUBLISHED") throw fail("NOT_EDITABLE");
  const merged = { ...contentOf(e), ...after };
  const problems = submitProblems({ ...merged, categoryIsLeaf: await assertCategory(tx, merged.categoryId) }, now);
  // Başvuru açılışı geçmişte kalabilir (yayındaki etkinlik); yalnızca diğer sorunlar engeller.
  if (Object.keys(problems).length) throw fail("INCOMPLETE", problems);
}

export async function assertCancellable(tx: Tx, clubId: string, eventId: string): Promise<void> {
  const e = await loadInClub(tx, clubId, eventId);
  if (e.status !== "PUBLISHED") throw fail("NOT_EDITABLE");
}

export async function setEventStatus(tx: Tx, eventId: string, from: "DRAFT" | "PENDING" | "PUBLISHED", to: "DRAFT" | "PENDING" | "PUBLISHED" | "CANCELLED"): Promise<void> {
  const now = new Date();
  const { count } = await tx.event.updateMany({
    where: { id: eventId, status: from },
    data: { status: to, ...(to === "PUBLISHED" ? { publishedAt: now } : {}), ...(to === "CANCELLED" ? { cancelledAt: now } : {}) },
  });
  if (count === 0) throw fail("NOT_EDITABLE");
}

export async function applyEventUpdate(tx: Tx, eventId: string, after: Partial<EventContent>): Promise<void> {
  await setEventStatus(tx, eventId, "PUBLISHED", "PUBLISHED");
  await tx.event.update({ where: { id: eventId }, data: eventData(after) });
  if (after.images) await replaceImages(tx, eventId, after.images);
}

/** Admin fark görünümü için okunur değerler. */
export function describeValue(field: string, value: unknown): string | number | boolean | null | string[] {
  if (value === null || value === undefined) return null;
  if (field === "descriptionTr") return docToPlainText(asRichDoc(value)).slice(0, 1500);
  if (field === "images" && Array.isArray(value)) return value.map((v: { key?: string }) => String(v.key ?? ""));
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return JSON.stringify(value);
}
