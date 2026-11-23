import "server-only";

import { cookies } from "next/headers";

import { createT, toLocale, type Locale, type Translate } from "./messages";

export const LOCALE_COOKIE = "gu_locale";

/** İstek dili: `gu_locale` cookie'si, yoksa tr. (F3'te next-intl devralır.) */
export async function getLocale(): Promise<Locale> {
  return toLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}

export async function getT(): Promise<Translate> {
  return createT(await getLocale());
}
