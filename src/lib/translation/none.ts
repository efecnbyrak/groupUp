import type { TranslationProvider } from "./types";

/** TRANSLATION_PROVIDER=none: çeviri yapılmaz, arayüz TR gösterir. */
export const noneProvider: TranslationProvider = {
  name: "none",
  translate: async () => null,
};
