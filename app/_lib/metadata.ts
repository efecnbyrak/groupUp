import type { Metadata } from "next";

import type { MessageKey } from "@/i18n/messages";
import { getT } from "@/i18n/server";

/** Çevrilmiş sayfa başlığı: `export const generateMetadata = titled("auth.login.title")`. */
export function titled(key: MessageKey): () => Promise<Metadata> {
  return async () => ({ title: `${(await getT())(key)} — groupUp` });
}
