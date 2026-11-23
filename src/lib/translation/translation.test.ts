import { describe, expect, it, vi } from "vitest";

import { createDeepLProvider } from "./deepl";
import { noneProvider } from "./none";

describe("noneProvider", () => {
  it("çeviri yapmaz", async () => {
    expect(await noneProvider.translate({ texts: ["a"], source: "tr", target: "en" })).toBeNull();
  });
});

describe("DeepL", () => {
  it("toplu istek gönderir, HTML'de tag_handling ekler", async () => {
    const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { text: string[] };
      return new Response(JSON.stringify({ translations: body.text.map((t) => ({ text: `EN:${t}` })) }), { status: 200 });
    });
    const p = createDeepLProvider({ apiKey: "k", apiUrl: "https://api-free.deepl.com/", fetch: fetch as unknown as typeof globalThis.fetch });
    const texts = Array.from({ length: 60 }, (_, i) => `t${i}`);
    const out = await p.translate({ texts, html: true, source: "tr", target: "en" });
    expect(out?.[59]).toBe("EN:t59");
    expect(fetch).toHaveBeenCalledTimes(2);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api-free.deepl.com/v2/translate");
    expect(JSON.parse(String(init?.body))).toMatchObject({ source_lang: "TR", target_lang: "EN-US", tag_handling: "html" });
    expect((init?.headers as Record<string, string>).Authorization).toBe("DeepL-Auth-Key k");
  });
  it("hata/kota durumunda null döner", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const p = createDeepLProvider({ apiKey: "k", apiUrl: "https://x", fetch: (async () => new Response("quota", { status: 456 })) as typeof globalThis.fetch });
    expect(await p.translate({ texts: ["a"], source: "tr", target: "en" })).toBeNull();
    err.mockRestore();
  });
});
