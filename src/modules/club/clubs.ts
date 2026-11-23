import "server-only";

import { audit } from "@/lib/audit";
import { db, type Tx } from "@/lib/db";
import { detectFileType, MB } from "@/lib/file-type";
import { toCoverWebp, toLogoWebp } from "@/lib/images";
import { getStorage, newFileKey } from "@/lib/storage";
import { slugify } from "@/lib/slug";

import { docToText, textToDoc } from "./description";
import type { ClubInfoInput, CreateClubInput } from "./schemas";
import { fail, isUniqueViolation } from "./service";

interface Actor {
  id: string;
}

/** CLUB_UPDATE kapsamındaki alanlar (ad hariç) — APPROVALS-TICKETS §4. */
export const CLUB_INFO_FIELDS = ["shortDescTr", "description", "contactEmail", "instagram", "logoKey", "coverKey"] as const;
export type ClubInfoField = (typeof CLUB_INFO_FIELDS)[number];
export type ClubInfo = { shortDescTr: string; description: string | null; contactEmail: string | null; instagram: string | null; logoKey: string | null; coverKey: string | null };

export const CLUB_IMAGE_MAX_BYTES = 10 * MB;

/** Başkan adayı: aynı üniversiteden ACTIVE öğrenci (mezun başkan olamaz — ELECTIONS). */
async function findPresidentCandidate(client: Tx | typeof db, universityId: string, email: string) {
  const user = await client.user.findUnique({ where: { email }, select: { id: true, universityId: true, status: true, type: true, deletedAt: true } });
  if (!user || user.universityId !== universityId || user.status !== "ACTIVE" || user.type !== "STUDENT" || user.deletedAt) {
    throw fail("PRESIDENT_INVALID", { presidentEmail: "club.errors.presidentInvalid", email: "club.errors.presidentInvalid" });
  }
  return user.id;
}

async function guardUnique<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (isUniqueViolation(err)) {
      const target = String((err as { meta?: { target?: unknown } }).meta?.target ?? "");
      if (target.includes("presidentId")) throw fail("ALREADY_PRESIDENT", { presidentEmail: "club.errors.alreadyPresident", email: "club.errors.alreadyPresident" });
      throw fail("SLUG_TAKEN", { slug: "university.errors.slugTaken" });
    }
    throw err;
  }
}

/** Admin: kulüp aç + Başkan ata (Başkan otomatik ACTIVE üye olur). */
export async function createClub(actor: Actor, input: CreateClubInput): Promise<{ id: string; slug: string }> {
  const slug = input.slug ?? slugify(input.name);
  if (!slug) throw fail("SLUG_TAKEN", { slug: "validation.slug" });
  return guardUnique(() =>
    db.$transaction(async (tx) => {
      const category = await tx.clubCategory.findUnique({ where: { id: input.categoryId }, select: { id: true } });
      if (!category) throw fail("NOT_FOUND", { categoryId: "validation.required" });
      const presidentId = await findPresidentCandidate(tx, input.universityId, input.presidentEmail);
      if (await tx.club.findUnique({ where: { presidentId }, select: { id: true } })) {
        throw fail("ALREADY_PRESIDENT", { presidentEmail: "club.errors.alreadyPresident" });
      }
      const club = await tx.club.create({
        data: { universityId: input.universityId, categoryId: input.categoryId, slug, name: input.name, shortDescTr: input.shortDescTr, presidentId },
        select: { id: true, slug: true },
      });
      await tx.membership.create({ data: { clubId: club.id, userId: presidentId, joinedVia: "admin" } });
      await audit({ action: "club.club.created", targetType: "Club", targetId: club.id, actorId: actor.id, universityId: input.universityId, meta: { slug, presidentId } }, tx);
      return club;
    }),
  );
}

/** Admin: Başkanı değiştir. Eski başkan üye olarak kalır; yeni başkan görevliyse görevliliği kalkar. */
export async function assignPresident(actor: Actor, universityId: string, clubId: string, email: string): Promise<void> {
  await guardUnique(() =>
    db.$transaction(async (tx) => {
      const club = await tx.club.findFirst({ where: { id: clubId, universityId, deletedAt: null }, select: { id: true, presidentId: true } });
      if (!club) throw fail("NOT_FOUND");
      const presidentId = await findPresidentCandidate(tx, universityId, email);
      if (club.presidentId === presidentId) return;
      const elsewhere = await tx.club.findUnique({ where: { presidentId }, select: { id: true } });
      if (elsewhere) throw fail("ALREADY_PRESIDENT", { email: "club.errors.alreadyPresident" });
      await tx.club.update({ where: { id: clubId }, data: { presidentId } });
      await tx.staffAssignment.deleteMany({ where: { clubId, userId: presidentId } });
      await tx.membership.upsert({
        where: { clubId_userId: { clubId, userId: presidentId } },
        update: { status: "ACTIVE", leftAt: null, bannedUntil: null },
        create: { clubId, userId: presidentId, joinedVia: "admin" },
      });
      await audit({ action: "club.president.assigned", targetType: "Club", targetId: clubId, actorId: actor.id, universityId, meta: { from: club.presidentId, to: presidentId } }, tx);
    }),
  );
}

/** Kulübün CLUB_UPDATE kapsamındaki mevcut değerleri (fark görünümü için "before"). */
export async function getClubInfo(clubId: string, client: Tx | typeof db = db): Promise<ClubInfo & { universityId: string; name: string }> {
  const club = await client.club.findFirst({
    where: { id: clubId, deletedAt: null },
    select: { universityId: true, name: true, shortDescTr: true, descriptionTr: true, contactEmail: true, instagram: true, logoKey: true, coverKey: true },
  });
  if (!club) throw fail("NOT_FOUND");
  return {
    universityId: club.universityId,
    name: club.name,
    shortDescTr: club.shortDescTr,
    description: docToText(club.descriptionTr) || null,
    contactEmail: club.contactEmail,
    instagram: club.instagram,
    logoKey: club.logoKey,
    coverKey: club.coverKey,
  };
}

/** Onaylanan CLUB_UPDATE'i uygular (handler, transaction içinde). */
export async function applyClubUpdate(tx: Tx, clubId: string, after: Partial<ClubInfo>): Promise<void> {
  const data: Record<string, unknown> = {};
  if (after.shortDescTr !== undefined) data.shortDescTr = after.shortDescTr;
  if (after.description !== undefined) data.descriptionTr = textToDoc(after.description) ?? null;
  if (after.contactEmail !== undefined) data.contactEmail = after.contactEmail;
  if (after.instagram !== undefined) data.instagram = after.instagram;
  if (after.logoKey !== undefined) data.logoKey = after.logoKey;
  if (after.coverKey !== undefined) data.coverKey = after.coverKey;
  // Çeviri F6'da (src/lib/translation): EN alanları sıfırlanır, arayüz TR'ye düşer.
  if (data.shortDescTr !== undefined || data.descriptionTr !== undefined) Object.assign(data, { shortDescEn: null, descriptionEn: null, translationHash: null });
  const { count } = await tx.club.updateMany({ where: { id: clubId, deletedAt: null }, data: data as never });
  if (count === 0) throw fail("NOT_FOUND");
}

/** Admin: kulüp bilgilerini doğrudan güncelle (talepsiz, audit'li). */
export async function updateClubDirect(actor: Actor, universityId: string, clubId: string, input: ClubInfoInput & Partial<Pick<ClubInfo, "logoKey" | "coverKey">>): Promise<void> {
  await db.$transaction(async (tx) => {
    const club = await tx.club.findFirst({ where: { id: clubId, universityId, deletedAt: null }, select: { id: true } });
    if (!club) throw fail("NOT_FOUND");
    await applyClubUpdate(tx, clubId, input);
    await audit({ action: "club.club.updatedDirect", targetType: "Club", targetId: clubId, actorId: actor.id, universityId, meta: { fields: Object.keys(input) } }, tx);
  });
}

/** Logo/kapak: doğrula → WebP → public depoya yaz; anahtarı döner (talep veya doğrudan güncelleme kullanır). */
export async function storeClubImage(clubId: string, kind: "logo" | "cover", file: Buffer): Promise<string> {
  if (file.byteLength === 0) throw fail("FILE_INVALID");
  if (file.byteLength > CLUB_IMAGE_MAX_BYTES) throw fail("FILE_TOO_LARGE");
  const type = detectFileType(file);
  if (!type || type.ext === "pdf") throw fail("FILE_TYPE");
  let webp: Buffer;
  try {
    webp = kind === "logo" ? await toLogoWebp(file) : await toCoverWebp(file);
  } catch {
    throw fail("FILE_INVALID");
  }
  const key = newFileKey(`clubs/${kind}`, clubId, "webp");
  await getStorage().put(key, webp, "public");
  return key;
}

export async function isClubPresident(userId: string, client: Tx | typeof db = db): Promise<boolean> {
  return (await client.club.findFirst({ where: { presidentId: userId, deletedAt: null }, select: { id: true } })) !== null;
}
