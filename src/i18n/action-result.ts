import "server-only";

import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";

import { ForbiddenError, UnauthorizedError } from "@/lib/authz";
import { RateLimitError, ServiceError, type ActionResult } from "@/lib/errors";

import type { MessageKey, Translate } from "./messages";
import { getT } from "./server";

/**
 * Action hata çevirisi. zod mesajları ve ServiceError kodları mesaj anahtarıdır
 * (ör. "validation.email"); burada kullanıcının diline çevrilir.
 */
export function invalidForm(error: z.ZodError, t: Translate): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".") || "_form";
    if (!(field in fieldErrors)) {
      const max = "maximum" in issue ? Number(issue.maximum) : undefined;
      fieldErrors[field] = t(issue.message as MessageKey, max !== undefined ? { max } : undefined);
    }
  }
  return { ok: false, error: t("errors.invalidForm"), fieldErrors };
}

/** Bilinen hataları çevirir; bilinmeyeni loglayıp genel mesaj döner. */
export function actionError<C extends string>(
  err: unknown,
  t: Translate,
  codes: Partial<Record<C, MessageKey>> = {},
): ActionResult<never> {
  if (err instanceof RateLimitError) {
    return { ok: false, error: t("errors.rateLimited", { minutes: Math.max(1, Math.ceil(err.retryAfterSec / 60)) }) };
  }
  if (err instanceof UnauthorizedError) return { ok: false, error: t("errors.unauthorized") };
  if (err instanceof ForbiddenError) return { ok: false, error: t("errors.forbidden") };
  if (err instanceof ServiceError) {
    const key = codes[err.code as C];
    if (key) {
      const fieldErrors = err.fields
        ? Object.fromEntries(Object.entries(err.fields).map(([f, k]) => [f, t(k as MessageKey)]))
        : undefined;
      return { ok: false, error: t(key), fieldErrors };
    }
  }
  console.error("[action]", err);
  return { ok: false, error: t("errors.generic") };
}

/** FormData → düz nesne (aynı ada sahip tekrar eden alanlarda sonuncusu). */
export function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) out[key] = value;
  }
  return out;
}

/**
 * Ortak action gövdesi — sıra her zaman: authz → zod → servis.
 * `authorize` ilk iştir; hata/yetkisizlik çevrilmiş `ActionResult` olur. `redirect()` /
 * `notFound()` çağrıları `unstable_rethrow` ile Next'e geri fırlatılır.
 */
export async function runAction<S extends z.ZodType, U>(
  formData: FormData,
  opts: {
    authorize: () => Promise<U>;
    schema: S;
    errors?: Partial<Record<string, MessageKey>>;
    run: (user: U, data: z.output<S>, t: Translate, formData: FormData) => Promise<ActionResult | void>;
  },
): Promise<ActionResult> {
  const t = await getT();
  try {
    const user = await opts.authorize();
    const parsed = opts.schema.safeParse(formToObject(formData));
    if (!parsed.success) return invalidForm(parsed.error, t);
    return (await opts.run(user, parsed.data, t, formData)) ?? { ok: true };
  } catch (err) {
    unstable_rethrow(err);
    return actionError(err, t, opts.errors);
  }
}
