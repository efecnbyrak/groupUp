import { z } from "zod";

import { richDocSchema } from "@/lib/rich-text/doc";

import { CAPACITY_MAX, EVENT_GALLERY_MAX, EVENT_SUMMARY_MAX, EVENT_TITLE_MAX, TEAM_SIZE_MAX } from "./rules";

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

// ---------------------------------------------------------------- Etkinlik (F6)

const id = z.string().trim().min(1).max(40);
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: "validation.tooLong" })
    .nullish()
    .transform((v) => v || null);
const optUrl = z
  .string()
  .trim()
  .max(500, { error: "validation.tooLong" })
  .nullish()
  .transform((v) => v || null)
  .refine((v) => v === null || /^https?:\/\//i.test(v), { error: "validation.url" });
const optDate = z
  .union([z.string().max(40), z.date()])
  .nullish()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "validation.date" });
      return z.NEVER;
    }
    return d;
  });
const optInt = (min: number, max: number) => z.number({ error: "validation.number" }).int({ error: "validation.number" }).min(min, { error: "validation.number" }).max(max, { error: "validation.number" }).nullish().transform((v) => v ?? null);
/** Etkinliğe ait public görsel anahtarı (sunucu ayrıca `event/<eventId>/` önekini kontrol eder). */
const imageKey = z.string().max(200).regex(/^events\/[a-z0-9]+\/[a-z0-9]+\.webp$/, { error: "validation.invalid" });

/** Sihirbaz durumu (taslak: her alan boş olabilir; yayın şartları `submitProblems`). */
export const eventContentSchema = z.object({
  categoryId: id,
  titleTr: z.string().trim().max(EVENT_TITLE_MAX, { error: "validation.tooLong" }),
  summaryTr: z.string().trim().max(EVENT_SUMMARY_MAX, { error: "validation.tooLong" }),
  descriptionTr: richDocSchema,
  coverKey: imageKey.nullish().transform((v) => v ?? null),
  images: z.array(z.object({ key: imageKey, alt: optText(200) })).max(EVENT_GALLERY_MAX, { error: "event.errors.galleryMax" }),
  locationName: optText(120),
  locationAddress: optText(300),
  mapUrl: optUrl,
  isOnline: z.boolean(),
  onlineUrl: optUrl,
  startAt: optDate,
  endAt: optDate,
  applyOpensAt: optDate,
  applyClosesAt: optDate,
  capacity: optInt(1, CAPACITY_MAX),
  waitlistEnabled: z.boolean(),
  autoPromoteWaitlist: z.boolean(),
  autoAccept: z.boolean(),
  mode: z.enum(["INDIVIDUAL", "TEAM"]),
  teamMinSize: optInt(1, TEAM_SIZE_MAX),
  teamMaxSize: optInt(1, TEAM_SIZE_MAX),
  eligibility: z.enum(["ALL_MEMBERS", "STUDENTS_ONLY", "ALUMNI_ONLY"]),
});
export type EventContent = z.output<typeof eventContentSchema>;
export const EVENT_CONTENT_FIELDS = Object.keys(eventContentSchema.shape) as (keyof EventContent)[];

/** Form: JSON gövdeli `data` alanı. */
const jsonField = <S extends z.ZodType>(schema: S) =>
  z
    .string()
    .max(500_000)
    .transform((v, ctx) => {
      try {
        return JSON.parse(v) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "validation.invalid" });
        return z.NEVER;
      }
    })
    .pipe(schema);

export const eventSaveSchema = z.object({ eventId: id, data: jsonField(eventContentSchema) });
export const eventCreateSchema = z.object({
  clubId: id,
  categoryId: id,
  titleTr: z.string().trim().min(1, { error: "validation.required" }).max(EVENT_TITLE_MAX, { error: "validation.tooLong" }),
});
export const eventIdSchema = z.object({ eventId: id });
export const eventImageSchema = z.object({ eventId: id, kind: z.enum(["cover", "gallery", "inline"]) });

/** Duyuru (ANNOUNCEMENT_POST). */
export const announcementSchema = z.object({
  clubId: id,
  titleTr: z.string().trim().min(1, { error: "validation.required" }).max(120, { error: "validation.tooLong" }),
  body: z.string().trim().min(1, { error: "validation.required" }).max(5000, { error: "validation.tooLong" }),
  pinned: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
});
