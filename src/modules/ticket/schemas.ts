import { z } from "zod";

const id = z.string().trim().min(1).max(40);
export const TICKET_CATEGORIES = ["EVENT", "APPROVAL", "MEMBERSHIP", "TOURNAMENT", "TECHNICAL", "OTHER"] as const;
const body = z.string().trim().min(1, { error: "validation.required" }).max(5000, { error: "validation.tooLong" });

const base = {
  category: z.enum(TICKET_CATEGORIES, { error: "validation.required" }),
  subject: z.string().trim().min(3, { error: "validation.required" }).max(160, { error: "validation.tooLong" }),
  body,
  changeRequestId: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => v || null),
};

export const openClubTicketSchema = z.object({ clubId: id, ...base });
export const openAdminTicketSchema = z.object({ universityId: id, ...base });
export type OpenTicketInput = { category: (typeof TICKET_CATEGORIES)[number]; subject: string; body: string; changeRequestId: string | null };

export const replySchema = z.object({ ticketId: id, body });
export const ticketIdSchema = z.object({ ticketId: id });
