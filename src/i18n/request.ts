import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { LOCALE_COOKIE, toLocale } from "./config";
import { catalogs, createT, DEFAULT_LOCALE, type MessageKey } from "./messages";

/** next-intl istek yapılandırması: dil `gu_locale` cookie'sinden (URL prefix yok). */
export default getRequestConfig(async ({ locale: override }) => {
  const locale = override ? toLocale(override) : toLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const fallback = createT(DEFAULT_LOCALE);
  return {
    locale,
    messages: catalogs[locale],
    timeZone: "Europe/Istanbul",
    onError: (error) => {
      if (process.env.NODE_ENV !== "production") console.warn("[i18n]", error.message);
    },
    getMessageFallback: ({ key, namespace }) => fallback((namespace ? `${namespace}.${key}` : key) as MessageKey),
  };
});
