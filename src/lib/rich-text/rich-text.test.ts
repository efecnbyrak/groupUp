import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { asRichDoc, docToPlainText, isDocEmpty, richDocSchema, type RichDoc } from "./doc";
import { applyTranslatedBlocks, collectTextBlocks, docToHtml, htmlToInline, inlineToHtml } from "./html";
import { renderRichText, sanitizeRichHtml } from "./sanitize";

const doc: RichDoc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Başlık <b>" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Kalın", marks: [{ type: "bold" }] },
        { type: "text", text: " ve " },
        { type: "text", text: "link", marks: [{ type: "link", attrs: { href: "https://ornek.com/a?b=1&c=2" } }] },
        { type: "hardBreak" },
        { type: "text", text: "satır" },
      ],
    },
    { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "madde" }] }] }] },
    { type: "horizontalRule" },
    { type: "image", attrs: { src: "/api/files/event/x/a.webp", alt: "Afiş" } },
  ],
};

describe("richDocSchema", () => {
  it("geçerli doc'u kabul eder, fazla öznitelikleri atar", () => {
    const parsed = richDocSchema.parse({ type: "doc", content: [{ type: "heading", attrs: { level: 1, textAlign: "x" }, content: [{ type: "text", text: "a" }] }] });
    expect(parsed.content[0]).toEqual({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "a" }] });
  });
  it("javascript: bağlantısını ve yabancı görseli reddeder", () => {
    const bad = (marks: unknown) => richDocSchema.safeParse({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks }] }] }).success;
    expect(bad([{ type: "link", attrs: { href: "javascript:alert(1)" } }])).toBe(false);
    expect(richDocSchema.safeParse({ type: "doc", content: [{ type: "image", attrs: { src: "http://evil/x.png" } }] }).success).toBe(false);
    expect(richDocSchema.safeParse({ type: "doc", content: [{ type: "script" }] }).success).toBe(false);
  });
  it("asRichDoc geçersiz değerde boş doc döner", () => {
    expect(isDocEmpty(asRichDoc("<p>x</p>"))).toBe(true);
  });
});

describe("docToHtml + sanitize", () => {
  it("metni kaçışlar ve beklenen etiketleri üretir", () => {
    const html = docToHtml(doc);
    expect(html).toContain("<h2>Başlık &lt;b&gt;</h2>");
    expect(html).toContain("<strong>Kalın</strong>");
    expect(html).toContain('href="https://ornek.com/a?b=1&amp;c=2"');
    expect(html).toContain("<ul><li><p>madde</p></li></ul>");
  });
  it("sanitize script/onerror'u temizler, yabancı görseli atar", () => {
    const out = sanitizeRichHtml('<p onclick="x">a</p><script>alert(1)</script><img src="http://evil/x.png" onerror="y"><img src="/api/files/a.webp">');
    expect(out).not.toContain("script");
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("evil");
    expect(out).toContain('src="/api/files/a.webp"');
  });
  it("renderRichText DB değerinden güvenli HTML üretir", () => {
    expect(renderRichText(doc)).toContain('rel="noopener noreferrer nofollow"');
  });
  it("düz metin", () => {
    expect(docToPlainText(doc)).toBe("Başlık <b>\nKalın ve link\nsatır\nmadde");
  });
});

describe("çeviri gidiş-dönüşü", () => {
  it("inline HTML → düğümler aynı kalır", () => {
    const p = doc.content[1];
    if (p.type !== "paragraph") throw new Error();
    expect(htmlToInline(inlineToHtml(p.content))).toEqual(p.content);
  });
  it("blokları toplar ve çevrilmiş halini yerine koyar", () => {
    const blocks = collectTextBlocks(doc);
    expect(blocks).toHaveLength(4);
    const translated = applyTranslatedBlocks(doc, ["Title &lt;b&gt;", "<strong>Bold</strong> and <a href=\"https://ornek.com/a?b=1&amp;c=2\">link</a><br>line", "item", "Poster"]);
    expect(docToPlainText(translated)).toBe("Title <b>\nBold and link\nline\nitem");
    const img = translated.content[4];
    expect(img.type === "image" && img.attrs.alt).toBe("Poster");
    expect(richDocSchema.safeParse(translated).success).toBe(true);
  });
  it("tanınmayan etiketleri atar, metni korur", () => {
    expect(htmlToInline("<x>a</x><em>b</em>")).toEqual([{ type: "text", text: "a" }, { type: "text", text: "b", marks: [{ type: "italic" }] }]);
  });
});
