/**
 * Kulüp açıklaması: F5'te düz metin girilir, Tiptap uyumlu doc olarak saklanır (F6 editörü aynı
 * formatı okur). Yalnızca paragraf + metin düğümleri; HTML üretilmez. Saf fonksiyonlar.
 */
export const DESCRIPTION_MAX = 2000;

type TextNode = { type: "text"; text: string };
type ParagraphNode = { type: "paragraph"; content?: TextNode[] };
export type DescriptionDoc = { type: "doc"; content: ParagraphNode[] };

export function textToDoc(text: string | null | undefined): DescriptionDoc | null {
  const paragraphs = (text ?? "")
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return null;
  return { type: "doc", content: paragraphs.map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })) };
}

/** Doc'taki paragrafların düz metni (bilinmeyen düğümler yok sayılır, iç içe metin toplanır). */
export function docParagraphs(doc: unknown): string[] {
  if (!doc || typeof doc !== "object" || !("content" in doc) || !Array.isArray(doc.content)) return [];
  const collect = (node: unknown): string => {
    if (!node || typeof node !== "object") return "";
    if ("text" in node && typeof node.text === "string") return node.text;
    if ("content" in node && Array.isArray(node.content)) return node.content.map(collect).join(node.content.length && "type" in node && node.type === "doc" ? "\n" : "");
    return "";
  };
  return (doc.content as unknown[]).map(collect).map((s) => s.trim()).filter(Boolean);
}

export function docToText(doc: unknown): string {
  return docParagraphs(doc).join("\n\n");
}
