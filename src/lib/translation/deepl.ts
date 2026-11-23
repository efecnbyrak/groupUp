import type { TranslationInput, TranslationProvider } from "./types";

/** DeepL API'nin tek istekte kabul ettiği metin sayısı (resmî sınır 50). */
const BATCH = 50;

type Fetch = typeof fetch;

/**
 * DeepL REST (v2/translate). `tag_handling=html` HTML parçalarında etiketleri korur.
 * Hata/kota durumunda null döner (yayın engellenmez; cron sonra tekrar dener — §7.2).
 */
export function createDeepLProvider(opts: { apiKey: string; apiUrl: string; fetch?: Fetch; timeoutMs?: number }): TranslationProvider {
  const doFetch = opts.fetch ?? fetch;
  const endpoint = `${opts.apiUrl.replace(/\/$/, "")}/v2/translate`;
  async function call(texts: string[], html: boolean): Promise<string[]> {
    const res = await doFetch(endpoint, {
      method: "POST",
      headers: { Authorization: `DeepL-Auth-Key ${opts.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: texts, source_lang: "TR", target_lang: "EN-US", ...(html ? { tag_handling: "html" } : {}) }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
    });
    if (!res.ok) throw new Error(`DeepL ${res.status}`);
    const body = (await res.json()) as { translations?: { text?: unknown }[] };
    const out = (body.translations ?? []).map((t) => (typeof t.text === "string" ? t.text : ""));
    if (out.length !== texts.length) throw new Error("DeepL: beklenmeyen yanıt");
    return out;
  }
  return {
    name: "deepl",
    async translate(input: TranslationInput) {
      if (input.texts.length === 0) return [];
      try {
        const out: string[] = [];
        for (let i = 0; i < input.texts.length; i += BATCH) out.push(...(await call(input.texts.slice(i, i + BATCH), Boolean(input.html))));
        return out;
      } catch (err) {
        console.error("[translation] deepl", err instanceof Error ? err.message : err);
        return null;
      }
    },
  };
}
