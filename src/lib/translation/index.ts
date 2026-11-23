import "server-only";

import { createHash } from "node:crypto";

import { env } from "../env";
import { createDeepLProvider } from "./deepl";
import { noneProvider } from "./none";
import type { TranslationProvider } from "./types";

export type { TranslationInput, TranslationProvider } from "./types";

let provider: TranslationProvider | undefined;
let override: TranslationProvider | undefined;

export function getTranslator(): TranslationProvider {
  if (override) return override;
  if (provider) return provider;
  provider =
    env.TRANSLATION_PROVIDER === "deepl" && env.DEEPL_API_KEY
      ? createDeepLProvider({ apiKey: env.DEEPL_API_KEY, apiUrl: env.DEEPL_API_URL })
      : noneProvider;
  return provider;
}

/** Yalnızca testler: sağlayıcıyı değiştir (undefined → varsayılana dön). */
export function setTranslatorForTests(p: TranslationProvider | undefined): void {
  override = p;
}

/** Tekrar çevirme engeli: kaynak alanların kararlı özeti (§7.2 `translationHash`). */
export function translationHash(source: unknown): string {
  return createHash("sha256").update(JSON.stringify(source)).digest("hex");
}
