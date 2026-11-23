import "server-only";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/errors";
import { slugify } from "@/lib/slug";

import type { EventCategoryInput, EventCategoryUpdateInput } from "./schemas";

/**
 * event modülü — F4'te yalnızca kategori ağacı (iki seviye). Etkinlikler F6'da;
 * o zaman silmede etkinlik kullanımı da kontrol edilecek.
 */
export type EventErrorCode = "NOT_FOUND" | "SLUG_TAKEN" | "IN_USE" | "PARENT_INVALID";
const fail = (code: EventErrorCode, fields?: Record<string, string>) => new ServiceError(code, fields);
const isUniqueViolation = (err: unknown) => typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "P2002";

interface Actor {
  id: string;
}

/** Üst kategoriler + alt kategorileri, sıralı. */
export function listEventCategoryTree() {
  return db.eventCategory.findMany({
    where: { parentId: null },
    orderBy: [{ order: "asc" }, { nameTr: "asc" }],
    include: { children: { orderBy: [{ order: "asc" }, { nameTr: "asc" }] } },
  });
}

async function guardSlug<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (isUniqueViolation(err)) throw fail("SLUG_TAKEN", { slug: "university.errors.slugTaken" });
    throw err;
  }
}

export function createEventCategory(actor: Actor, input: EventCategoryInput): Promise<void> {
  const slug = input.slug ?? slugify(input.nameTr);
  return guardSlug(() =>
    db.$transaction(async (tx) => {
      if (input.parentId) {
        const parent = await tx.eventCategory.findUnique({ where: { id: input.parentId }, select: { parentId: true } });
        // Yalnızca iki seviye: alt kategorinin altına kategori eklenmez.
        if (!parent || parent.parentId) throw fail("PARENT_INVALID");
      }
      const row = await tx.eventCategory.create({
        data: { slug, nameTr: input.nameTr, nameEn: input.nameEn, order: input.order, parentId: input.parentId ?? null },
        select: { id: true },
      });
      await audit({ action: "event.category.created", targetType: "EventCategory", targetId: row.id, actorId: actor.id, meta: { slug, parentId: input.parentId ?? null } }, tx);
    }),
  );
}

export function updateEventCategory(actor: Actor, input: EventCategoryUpdateInput): Promise<void> {
  const slug = input.slug ?? slugify(input.nameTr);
  return guardSlug(() =>
    db.$transaction(async (tx) => {
      const { count } = await tx.eventCategory.updateMany({ where: { id: input.id }, data: { slug, nameTr: input.nameTr, nameEn: input.nameEn, order: input.order } });
      if (count === 0) throw fail("NOT_FOUND");
      await audit({ action: "event.category.updated", targetType: "EventCategory", targetId: input.id, actorId: actor.id, meta: { slug } }, tx);
    }),
  );
}

/** Alt kategorisi olan üst kategori silinmez. */
export async function deleteEventCategory(actor: Actor, id: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const row = await tx.eventCategory.findUnique({ where: { id }, select: { slug: true, _count: { select: { children: true } } } });
    if (!row) throw fail("NOT_FOUND");
    if (row._count.children > 0) throw fail("IN_USE");
    await tx.eventCategory.delete({ where: { id } });
    await audit({ action: "event.category.deleted", targetType: "EventCategory", targetId: id, actorId: actor.id, meta: { slug: row.slug } }, tx);
  });
}
