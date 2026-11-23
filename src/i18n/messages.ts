import { createTranslator } from "next-intl";

import en from "../../messages/en.json";
import tr from "../../messages/tr.json";

import { DEFAULT_LOCALE, type Locale } from "./config";

export { DEFAULT_LOCALE, isLocale, LOCALES, toLocale, type Locale } from "./config";

/**
 * İstek bağlamı dışında çeviri (mail şablonları, action hata çevirisi, testler).
 * next-intl'in `createTranslator`'ını kullanır → biçimlendirme (ICU) sayfalarla aynıdır.
 * Client bileşenlere metinler prop olarak geçer (`pickMessages`), katalog gönderilmez.
 */
export type Messages = typeof tr;
export const catalogs: Record<Locale, Messages> = { tr, en };

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;
export type TranslateVars = Record<string, string | number>;
export type Translate = (key: MessageKey, vars?: TranslateVars) => string;

/** Eksik anahtar/biçim hatasında: önce varsayılan dil, o da yoksa anahtarın kendisi. */
function rawTranslator(locale: Locale, fallback?: Translate): Translate {
  const t = createTranslator({
    locale,
    messages: catalogs[locale],
    timeZone: "Europe/Istanbul",
    onError: () => {},
    getMessageFallback: ({ key, namespace }) => {
      const full = (namespace ? `${namespace}.${key}` : key) as MessageKey;
      return fallback ? fallback(full) : full;
    },
  });
  return (key, vars) => (t as unknown as (k: string, v?: TranslateVars) => string)(key, vars);
}

const defaultT = rawTranslator(DEFAULT_LOCALE);
const translators: Record<Locale, Translate> = {
  tr: defaultT,
  en: rawTranslator("en", defaultT),
};

/** `t("auth.login.title")` — eksik anahtarda TR'ye, o da yoksa anahtarın kendisine düşer. */
export function createT(locale: Locale): Translate {
  return translators[locale];
}

/** Client bileşenlere geçirilecek metin alt kümesi (sunucuda çevrilir, prop olarak gider). */
export function pickMessages<K extends MessageKey>(t: Translate, keys: readonly K[]): Record<K, string> {
  return Object.fromEntries(keys.map((k) => [k, t(k)])) as Record<K, string>;
}
