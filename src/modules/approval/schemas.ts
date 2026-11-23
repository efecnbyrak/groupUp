import { z } from "zod";

import { STAFF_PERMISSIONS } from "@/lib/club-roles";

import { REJECT_REASON_MAX, REJECT_REASON_MIN, REQUEST_REASON_MAX } from "./domain/reason";

const id = z.string().trim().min(1).max(40);

/** Ret gerekçesi (kullanıcı kararı): trim, 10–500. Üye çıkarma/engelleme gerekçesi de aynı kural. */
export const reasonField = z
  .string({ error: "validation.required" })
  .trim()
  .min(1, { error: "validation.required" })
  .min(REJECT_REASON_MIN, { error: "approval.validation.reasonTooShort" })
  .max(REJECT_REASON_MAX, { error: "validation.tooLong" });

const optionalReason = z
  .string()
  .trim()
  .max(REQUEST_REASON_MAX, { error: "validation.tooLong" })
  .optional()
  .transform((v) => v || null);

export const rejectSchema = z.object({ universityId: id, requestId: id, reason: reasonField });
export const approveSchema = z.object({ universityId: id, requestId: id });
export const requestIdSchema = z.object({ requestId: id });

const permissionFields = Object.fromEntries(STAFF_PERMISSIONS.map((p) => [`perm_${p}`, z.literal("on").optional()])) as Record<
  `perm_${(typeof STAFF_PERMISSIONS)[number]}`,
  z.ZodOptional<z.ZodLiteral<"on">>
>;

/** Görevli ata / güncelle formu: yetkiler tek tek checkbox (perm_EVENT_MANAGE=on …). */
export const staffAssignFormSchema = z
  .object({
    clubId: id,
    userId: id,
    title: z.string().trim().min(1, { error: "validation.required" }).max(60, { error: "validation.tooLong" }),
    ...permissionFields,
  })
  .transform((v) => ({
    clubId: v.clubId,
    userId: v.userId,
    title: v.title,
    permissions: STAFF_PERMISSIONS.filter((p) => v[`perm_${p}`] === "on"),
  }));

export const staffRemoveFormSchema = z.object({ clubId: id, userId: id, reason: optionalReason });
export const memberRemoveFormSchema = z.object({ clubId: id, userId: id, reason: reasonField });
export const memberBanFormSchema = z.object({
  clubId: id,
  userId: id,
  reason: reasonField,
  until: z
    .string()
    .trim()
    .regex(/^$|^\d{4}-\d{2}-\d{2}$/, { error: "approval.validation.date" })
    .optional()
    .transform((v) => v || null),
});

export const queueFilterTypes = ["CLUB_UPDATE", "MEMBER_REMOVE", "MEMBER_BAN", "STAFF_ASSIGN", "STAFF_REMOVE", "ALUMNI_VERIFY"] as const;
