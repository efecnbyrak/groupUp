import { z } from "zod";

export const universityRequestSchema = z.object({
  email: z.email({ error: "validation.email" }).max(254).transform((v) => v.trim().toLowerCase()),
  name: z.string().trim().min(1, { error: "validation.required" }).max(150, { error: "validation.tooLong" }),
  note: z
    .string()
    .trim()
    .max(500, { error: "validation.tooLong" })
    .transform((v) => v || undefined)
    .optional(),
});

export type UniversityRequestInput = z.infer<typeof universityRequestSchema>;

// ---------------------------------------------------------------- Platform (Süper Admin)

const text = (max: number) =>
  z.string().trim().min(1, { error: "validation.required" }).max(max, { error: "validation.tooLong" });
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: "validation.tooLong" })
    .transform((v) => v || undefined)
    .optional();
const id = z.string().trim().min(1, { error: "validation.required" }).max(40);

export const universitySchema = z.object({
  name: text(150),
  slug: z
    .string()
    .trim()
    .max(80, { error: "validation.tooLong" })
    .regex(/^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/, { error: "validation.slug" })
    .transform((v) => v || undefined)
    .optional(),
  city: optionalText(80),
  alumniVerifyMode: z.enum(["DOMAIN", "MANUAL", "BOTH"], { error: "validation.required" }),
  /** Üniversite talebinden oluşturuluyorsa talep APPROVED olur. */
  requestId: optionalText(40),
});
export type UniversityInput = z.infer<typeof universitySchema>;

export const universityUpdateSchema = universitySchema.omit({ requestId: true }).extend({ universityId: id });
export type UniversityUpdateInput = z.infer<typeof universityUpdateSchema>;

export const universityActiveSchema = z.object({ universityId: id, active: z.enum(["true", "false"]).transform((v) => v === "true") });

export const domainSchema = z.object({
  universityId: id,
  domain: text(253),
  type: z.enum(["STUDENT", "ALUMNI"], { error: "validation.required" }),
});
export type DomainInput = z.infer<typeof domainSchema>;

export const assignAdminSchema = z.object({
  universityId: id,
  email: z.email({ error: "validation.email" }).max(254).transform((v) => v.trim().toLowerCase()),
});

export const idSchema = z.object({ id });



// ---------------------------------------------------------------- Admin (fakülte/bölüm)

export const facultySchema = z.object({ nameTr: text(150), nameEn: optionalText(150) });
export const facultyUpdateSchema = facultySchema.extend({ id });
export const departmentSchema = facultySchema.extend({ facultyId: id });
export const departmentUpdateSchema = facultySchema.extend({ id });
export type NamesInput = z.infer<typeof facultySchema>;
