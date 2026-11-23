import { z } from "zod";

const text = (max: number) => z.string().trim().min(1, { error: "validation.required" }).max(max, { error: "validation.tooLong" });

/** Kulüp kategorisi (Süper Admin). Slug boşsa Türkçe addan üretilir. */
export const clubCategorySchema = z.object({
  nameTr: text(80),
  nameEn: text(80),
  slug: z
    .string()
    .trim()
    .max(80, { error: "validation.tooLong" })
    .regex(/^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/, { error: "validation.slug" })
    .transform((v) => v || undefined)
    .optional(),
  icon: z
    .string()
    .trim()
    .max(40, { error: "validation.tooLong" })
    .regex(/^$|^[a-z0-9-]+$/, { error: "validation.icon" })
    .transform((v) => v || undefined)
    .optional(),
  order: z.coerce.number({ error: "validation.number" }).int({ error: "validation.number" }).min(0).max(999).default(0),
});
export type ClubCategoryInput = z.infer<typeof clubCategorySchema>;

export const clubCategoryUpdateSchema = clubCategorySchema.extend({ id: z.string().trim().min(1).max(40) });
export const categoryIdSchema = z.object({ id: z.string().trim().min(1).max(40) });
