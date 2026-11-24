"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/i18n/action-result";
import { requireUser } from "@/lib/authz";
import type { ActionResult } from "@/lib/errors";

import { notificationIdSchema } from "./schemas";
import { markAllNotificationsRead, markNotificationRead } from "./notifications";

type Prev = ActionResult | null;
const refresh = () => revalidatePath("/", "layout");

export async function markNotificationReadAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: () => requireUser(),
    schema: notificationIdSchema,
    run: async (user, data) => {
      await markNotificationRead(user.id, data.id);
      refresh();
    },
  });
}

export async function markAllNotificationsReadAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: () => requireUser(),
    schema: notificationIdSchema.partial(),
    run: async (user) => {
      await markAllNotificationsRead(user.id);
      refresh();
    },
  });
}
