import "server-only";

import { getLocale as intlLocale, getTranslations } from "next-intl/server";

import { toLocale, type Locale } from "./config";
import type { Translate, TranslateVars } from "./messages";

export { LOCALE_COOKIE } from "./config";

/** İstek dili (next-intl → `gu_locale` cookie'si, yoksa tr). */
export async function getLocale(): Promise<Locale> {
  return toLocale(await intlLocale());
}

/** İstek diline bağlı çevirici; imza F2'deki ile aynı (`MessageKey` tipli). */
export async function getT(): Promise<Translate> {
  const t = await getTranslations();
  return (key, vars) => (t as unknown as (k: string, v?: TranslateVars) => string)(key, vars);
}
