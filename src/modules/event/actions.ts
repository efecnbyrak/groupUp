"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/i18n/action-result";
import type { MessageKey } from "@/i18n/messages";
import { requireSuperAdmin } from "@/lib/authz";
import type { ActionResult } from "@/lib/errors";

import { eventCategoryIdSchema, eventCategorySchema, eventCategoryUpdateSchema } from "./schemas";
import { createEventCategory, deleteEventCategory, updateEventCategory, type EventErrorCode } from "./service";

type Prev = ActionResult | null;
const errors: Partial<Record<EventErrorCode, MessageKey>> = {
  NOT_FOUND: "university.errors.notFound",
  SLUG_TAKEN: "university.errors.slugTaken",
  IN_USE: "platform.categories.hasChildren",
  PARENT_INVALID: "platform.categories.parentInvalid",
};
const refresh = () => revalidatePath("/panel/platform/kategoriler");

export async function createEventCategoryAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireSuperAdmin,
    schema: eventCategorySchema,
    errors,
    run: async (user, data, t) => {
      await createEventCategory(user, data);
      refresh();
      return { ok: true, message: t("platform.categories.created") };
    },
  });
}

export async function updateEventCategoryAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireSuperAdmin,
    schema: eventCategoryUpdateSchema,
    errors,
    run: async (user, data) => {
      await updateEventCategory(user, data);
      refresh();
    },
  });
}

export async function deleteEventCategoryAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireSuperAdmin,
    schema: eventCategoryIdSchema,
    errors,
    run: async (user, data) => {
      await deleteEventCategory(user, data.id);
      refresh();
    },
  });
}
