"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { unstable_rethrow } from "next/navigation";

import { actionError, runAction } from "@/i18n/action-result";
import { getT } from "@/i18n/server";
import { requireUser } from "@/lib/authz";
import type { ActionResult } from "@/lib/errors";
import { enforceRateLimits } from "@/lib/rate-limit";

import { PROFILE_ERROR_KEYS as errors } from "./errors";
import { profileUpdateSchema } from "./schemas";
import { AVATAR_MAX_BYTES, fail, removeAvatar, setAvatar, updateProfile } from "./service";

type Prev = ActionResult | null;
const refresh = () => revalidatePath("/", "layout");

export async function updateProfileAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireUser,
    schema: profileUpdateSchema,
    errors,
    run: async (user, data, t) => {
      await updateProfile(user, data);
      refresh();
      return { ok: true, message: t("profile.saved") };
    },
  });
}

/** Dosya alanı FormData'dan ayrıca okunur (runAction yalnızca metin alanlarını işler). */
export async function uploadAvatarAction(_prev: Prev, formData: FormData): Promise<ActionResult> {
  const t = await getT();
  try {
    const user = await requireUser();
    await enforceRateLimits([{ key: `avatar:user:${user.id}`, limit: 20, windowSec: 3600 }]);
    const file = formData.get("avatar");
    if (!(file instanceof File) || file.size === 0) throw fail("FILE_INVALID", { avatar: "validation.required" });
    if (file.size > AVATAR_MAX_BYTES) throw fail("FILE_TOO_LARGE");
    await setAvatar(user, Buffer.from(await file.arrayBuffer()));
    refresh();
    return { ok: true, message: t("profile.avatar.updated") };
  } catch (err) {
    unstable_rethrow(err);
    return actionError(err, t, errors);
  }
}

export async function removeAvatarAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireUser,
    schema: z.object({}),
    errors,
    run: async (user, _data, t) => {
      await removeAvatar(user);
      refresh();
      return { ok: true, message: t("profile.avatar.removed") };
    },
  });
}
