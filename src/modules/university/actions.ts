"use server";

import { actionError, formToObject, invalidForm } from "@/i18n/action-result";
import { getT } from "@/i18n/server";
import type { ActionResult } from "@/lib/errors";
import { enforceRateLimits } from "@/lib/rate-limit";
import { currentIpKey } from "@/lib/session";

import { universityRequestSchema } from "./schemas";
import { createUniversityRequest } from "./service";

/** Public: "Üniversitem groupUp'ta yok" talebi. */
export async function requestUniversityAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const t = await getT();
  try {
    await enforceRateLimits([{ key: `uni-request:ip:${await currentIpKey()}`, limit: 5, windowSec: 3600 }]);
    const parsed = universityRequestSchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalidForm(parsed.error, t);
    await createUniversityRequest(parsed.data);
    return { ok: true, message: t("auth.register.requestSent") };
  } catch (err) {
    return actionError(err, t);
  }
}
