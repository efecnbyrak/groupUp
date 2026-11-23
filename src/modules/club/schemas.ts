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

// ---------------------------------------------------------------- Kulüp (F5)
const id = z.string().trim().min(1).max(40);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: "validation.tooLong" })
    .transform((v) => v || null)
    .nullable()
    .optional()
    .transform((v) => v ?? null);

const slugField = z
  .string()
  .trim()
  .max(80, { error: "validation.tooLong" })
  .regex(/^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/, { error: "validation.slug" })
  .transform((v) => v || undefined)
  .optional();

const emailField = z.string().trim().toLowerCase().pipe(z.email({ error: "validation.email" }));

/** Admin: kulüp aç + Başkan ata. */
export const createClubSchema = z.object({
  universityId: id,
  name: text(120),
  slug: slugField,
  categoryId: id,
  shortDescTr: text(200),
  presidentEmail: emailField,
});
export type CreateClubInput = z.infer<typeof createClubSchema>;

export const assignPresidentSchema = z.object({ universityId: id, clubId: id, email: emailField });

/** Kulüp bilgileri (CLUB_UPDATE kapsamı — ad hariç). Görseller ayrı dosya alanı. */
export const clubInfoSchema = z.object({
  shortDescTr: text(200),
  description: optionalText(2000),
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(200, { error: "validation.tooLong" })
    .refine((v) => v === "" || z.email().safeParse(v).success, { error: "validation.email" })
    .transform((v) => v || null),
  instagram: z
    .string()
    .trim()
    .regex(/^$|^@?[A-Za-z0-9._]{1,30}$/, { error: "validation.instagram" })
    .transform((v) => v.replace(/^@/, "") || null),
});
export type ClubInfoInput = z.infer<typeof clubInfoSchema>;

export const adminClubInfoSchema = clubInfoSchema.extend({ universityId: id, clubId: id });

const INVITE_EXPIRY = ["7", "30", "never"] as const;
export const inviteCreateSchema = z.object({
  clubId: id,
  expiresIn: z.enum(INVITE_EXPIRY, { error: "validation.required" }).default("30"),
  maxUses: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number({ error: "validation.number" }).int({ error: "validation.number" }).min(1, { error: "validation.number" }).max(10000, { error: "validation.number" }).nullable())
    .optional()
    .transform((v) => v ?? null),
});
export type InviteCreateInput = z.infer<typeof inviteCreateSchema>;
export const INVITE_EXPIRY_OPTIONS = INVITE_EXPIRY;

export const inviteIdSchema = z.object({ clubId: id, inviteId: id });
export const joinSchema = z.object({ code: z.string().trim().min(1, { error: "validation.required" }).max(20) });
export const clubIdSchema = z.object({ clubId: id });
export const adminMemberSchema = z.object({ universityId: id, clubId: id, userId: id });
