import en from "../../messages/en.json";
import tr from "../../messages/tr.json";

/**
 * Geçici çeviri yardımcısı (F2). F3'te next-intl ile değiştirilecek; anahtarlar aynı kalır.
 * Saf modül: hem sunucu hem test kullanır. Client bileşenlere metinler prop olarak geçer.
 */
export const LOCALES = ["tr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "tr";

type Messages = typeof tr;
const catalogs: Record<Locale, Messages> = { tr, en };

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;
export type TranslateVars = Record<string, string | number>;
export type Translate = (key: MessageKey, vars?: TranslateVars) => string;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function toLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

function lookup(messages: Messages, key: string): string | undefined {
  let node: unknown = messages;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/** `t("auth.login.title")` — eksik anahtarda TR'ye, o da yoksa anahtarın kendisine düşer. */
export function createT(locale: Locale): Translate {
  return (key, vars) => interpolate(lookup(catalogs[locale], key) ?? lookup(tr, key) ?? key, vars);
}

/** Client bileşenlere geçirilecek metin alt kümesi (sunucuda çevrilir, prop olarak gider). */
export function pickMessages<K extends MessageKey>(t: Translate, keys: readonly K[]): Record<K, string> {
  return Object.fromEntries(keys.map((k) => [k, t(k)])) as Record<K, string>;
}
