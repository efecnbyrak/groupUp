import { z } from "zod";

const text = (max: number) => z.string().trim().min(1, { error: "validation.required" }).max(max, { error: "validation.tooLong" });

/** Etkinlik kategorisi: üst kategori (parentId boş) veya alt kategori. */
export const eventCategorySchema = z.object({
  nameTr: text(80),
  nameEn: text(80),
  slug: z
    .string()
    .trim()
    .max(80, { error: "validation.tooLong" })
    .regex(/^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/, { error: "validation.slug" })
    .transform((v) => v || undefined)
    .optional(),
  parentId: z
    .string()
    .trim()
    .max(40)
    .transform((v) => v || undefined)
    .optional(),
  order: z.coerce.number({ error: "validation.number" }).int({ error: "validation.number" }).min(0).max(999).default(0),
});
export type EventCategoryInput = z.infer<typeof eventCategorySchema>;

export const eventCategoryUpdateSchema = eventCategorySchema.omit({ parentId: true }).extend({ id: z.string().trim().min(1).max(40) });
export type EventCategoryUpdateInput = z.infer<typeof eventCategoryUpdateSchema>;
export const eventCategoryIdSchema = z.object({ id: z.string().trim().min(1).max(40) });
