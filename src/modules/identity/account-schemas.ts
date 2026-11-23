import { z } from "zod";

export const sessionIdSchema = z.object({ id: z.string().trim().min(1).max(40) });

export const deleteAccountSchema = z.object({
  password: z.string({ error: "validation.required" }).min(1, { error: "validation.required" }).max(256),
  confirm: z.literal("on", { error: "account.delete.confirmRequired" }),
});

export const deleteTokenSchema = z.object({ token: z.string().min(10).max(200) });
