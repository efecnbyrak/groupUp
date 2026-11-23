"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { actionError, formToObject, invalidForm, runAction } from "@/i18n/action-result";
import type { MessageKey } from "@/i18n/messages";
import { getT } from "@/i18n/server";
import { requireUser } from "@/lib/authz";
import type { ActionResult } from "@/lib/errors";
import { enforceRateLimits } from "@/lib/rate-limit";
import { currentIpKey, destroyCurrentSession, destroyUserSessions } from "@/lib/session";

import { confirmAccountDeletion, requestAccountDeletion, revokeSession } from "./account";
import { deleteAccountSchema, deleteTokenSchema, sessionIdSchema } from "./account-schemas";
import { limits, type IdentityErrorCode } from "./service";

type Prev = ActionResult | null;
const errors: Partial<Record<IdentityErrorCode, MessageKey>> = {
  NOT_FOUND: "university.errors.notFound",
  WRONG_PASSWORD: "errors.invalidForm",
  LAST_SUPER_ADMIN: "account.delete.lastSuperAdmin",
  PRESIDENT_MUST_TRANSFER: "account.delete.presidentMustTransfer",
  DELETE_TOKEN_INVALID: "account.delete.invalidToken",
};

export async function revokeSessionAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireUser,
    schema: sessionIdSchema,
    errors,
    run: async (user, data, t) => {
      await revokeSession(user.id, data.id);
      revalidatePath("/hesap/oturumlar");
      return { ok: true, message: t("account.sessions.revoked") };
    },
  });
}

export async function revokeOtherSessionsAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireUser,
    schema: sessionIdSchema.partial(),
    errors,
    run: async (user, _data, t) => {
      const count = await destroyUserSessions(user.id, user.sessionId);
      revalidatePath("/hesap/oturumlar");
      return { ok: true, message: t("account.sessions.othersRevoked", { count }) };
    },
  });
}

export async function requestAccountDeletionAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireUser,
    schema: deleteAccountSchema,
    errors,
    run: async (user, data, t) => {
      await requestAccountDeletion(user, data.password);
      return { ok: true, message: t("account.delete.mailSent") };
    },
  });
}

/**
 * Maildeki linkten açılan onay sayfası. Token sahipliği kanıttır (şifre sıfırlama gibi);
 * oturum gerekmez — ilk iş IP rate limit'i. GET'te silme yapılmaz (link tarayıcıları).
 */
export async function confirmAccountDeletionAction(_prev: Prev, formData: FormData): Promise<ActionResult> {
  const t = await getT();
  try {
    await enforceRateLimits(limits.resetIp(await currentIpKey()));
    const parsed = deleteTokenSchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalidForm(parsed.error, t);
    await confirmAccountDeletion(parsed.data.token);
    await destroyCurrentSession();
  } catch (err) {
    return actionError(err, t, errors);
  }
  redirect("/giris?silindi=1");
}
