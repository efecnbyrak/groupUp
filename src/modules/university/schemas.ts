import { z } from "zod";

export const universityRequestSchema = z.object({
  email: z.email({ error: "validation.email" }).max(254).transform((v) => v.trim().toLowerCase()),
  name: z.string().trim().min(1, { error: "validation.required" }).max(150, { error: "validation.tooLong" }),
  note: z
    .string()
    .trim()
    .max(500, { error: "validation.tooLong" })
    .optional()
    .transform((v) => v || undefined),
});

export type UniversityRequestInput = z.infer<typeof universityRequestSchema>;
