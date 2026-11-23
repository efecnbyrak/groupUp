/** EVENTS-FORMS-I18N §7.2 — kaynak her zaman TR, hedef EN. */
export interface TranslationInput {
  texts: string[];
  /** true: metinler HTML parçası (etiketler korunur). */
  html?: boolean;
  source: "tr";
  target: "en";
}

export interface TranslationProvider {
  readonly name: "deepl" | "none";
  /** null: çeviri yapılmadı (sağlayıcı kapalı / hata) — çağıran EN alanını boş bırakır. */
  translate(input: TranslationInput): Promise<string[] | null>;
}
