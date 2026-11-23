"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/i18n/action-result";
import type { MessageKey } from "@/i18n/messages";
import { requireSuperAdmin } from "@/lib/authz";
import type { ActionResult } from "@/lib/errors";

import { categoryIdSchema, clubCategorySchema, clubCategoryUpdateSchema } from "./schemas";
import { createClubCategory, deleteClubCategory, updateClubCategory, type ClubErrorCode } from "./service";

type Prev = ActionResult | null;
const errors: Partial<Record<ClubErrorCode, MessageKey>> = {
  NOT_FOUND: "university.errors.notFound",
  SLUG_TAKEN: "university.errors.slugTaken",
  IN_USE: "university.errors.inUse",
};
const refresh = () => revalidatePath("/panel/platform/kategoriler");

export async function createClubCategoryAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireSuperAdmin,
    schema: clubCategorySchema,
    errors,
    run: async (user, data, t) => {
      await createClubCategory(user, data);
      refresh();
      return { ok: true, message: t("platform.categories.created") };
    },
  });
}

export async function updateClubCategoryAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireSuperAdmin,
    schema: clubCategoryUpdateSchema,
    errors,
    run: async (user, data) => {
      await updateClubCategory(user, data.id, data);
      refresh();
    },
  });
}

export async function deleteClubCategoryAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireSuperAdmin,
    schema: categoryIdSchema,
    errors,
    run: async (user, data) => {
      await deleteClubCategory(user, data.id);
      refresh();
    },
  });
}
