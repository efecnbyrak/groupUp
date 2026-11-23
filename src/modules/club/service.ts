import "server-only";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/errors";
import { slugify } from "@/lib/slug";

import type { ClubCategoryInput } from "./schemas";

/**
 * club modülü — F4'te yalnızca kategori yönetimi (Süper Admin). Kulüp/üyelik F5'te.
 * Kategori silme: F5'te kulüplerde kullanılıyorsa engellenecek (`IN_USE`).
 */
export type ClubErrorCode = "NOT_FOUND" | "SLUG_TAKEN" | "IN_USE";
const fail = (code: ClubErrorCode, fields?: Record<string, string>) => new ServiceError(code, fields);
const isUniqueViolation = (err: unknown) => typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "P2002";

interface Actor {
  id: string;
}

export function listClubCategories() {
  return db.clubCategory.findMany({ orderBy: [{ order: "asc" }, { nameTr: "asc" }] });
}

async function guardSlug<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (isUniqueViolation(err)) throw fail("SLUG_TAKEN", { slug: "university.errors.slugTaken" });
    throw err;
  }
}

export function createClubCategory(actor: Actor, input: ClubCategoryInput): Promise<void> {
  const slug = input.slug ?? slugify(input.nameTr);
  return guardSlug(() =>
    db.$transaction(async (tx) => {
      const row = await tx.clubCategory.create({ data: { slug, nameTr: input.nameTr, nameEn: input.nameEn, icon: input.icon ?? null, order: input.order }, select: { id: true } });
      await audit({ action: "club.category.created", targetType: "ClubCategory", targetId: row.id, actorId: actor.id, meta: { slug } }, tx);
    }),
  );
}

export function updateClubCategory(actor: Actor, id: string, input: ClubCategoryInput): Promise<void> {
  const slug = input.slug ?? slugify(input.nameTr);
  return guardSlug(() =>
    db.$transaction(async (tx) => {
      const { count } = await tx.clubCategory.updateMany({ where: { id }, data: { slug, nameTr: input.nameTr, nameEn: input.nameEn, icon: input.icon ?? null, order: input.order } });
      if (count === 0) throw fail("NOT_FOUND");
      await audit({ action: "club.category.updated", targetType: "ClubCategory", targetId: id, actorId: actor.id, meta: { slug } }, tx);
    }),
  );
}

export async function deleteClubCategory(actor: Actor, id: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const row = await tx.clubCategory.findUnique({ where: { id }, select: { slug: true } });
    if (!row) throw fail("NOT_FOUND");
    await tx.clubCategory.delete({ where: { id } });
    await audit({ action: "club.category.deleted", targetType: "ClubCategory", targetId: id, actorId: actor.id, meta: { slug: row.slug } }, tx);
  });
}
