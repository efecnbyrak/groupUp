/**
 * Tiptap JSON (EVENTS-FORMS-I18N §3 adım 2) — izinli düğüm/işaret kümesi, doğrulama ve düz metin.
 * Saf TS: hem istemci editörü hem sunucu kullanır. Bilinmeyen düğüm/işaret DB'ye yazılmaz.
 */
import { z } from "zod";

export const RICH_BLOCK_TYPES = ["paragraph", "heading", "bulletList", "orderedList", "listItem", "blockquote", "horizontalRule", "image"] as const;
export const RICH_INLINE_TYPES = ["text", "hardBreak"] as const;
export const RICH_MARK_TYPES = ["bold", "italic", "underline", "strike", "link"] as const;

export type RichMark = { type: "bold" | "italic" | "underline" | "strike" } | { type: "link"; attrs: { href: string } };
export type RichText = { type: "text"; text: string; marks?: RichMark[] };
export type RichInline = RichText | { type: "hardBreak" };
export type RichNode =
  | { type: "paragraph"; content?: RichInline[] }
  | { type: "heading"; attrs: { level: 1 | 2 | 3 }; content?: RichInline[] }
  | { type: "bulletList" | "orderedList"; content: RichNode[] }
  | { type: "listItem"; content: RichNode[] }
  | { type: "blockquote"; content: RichNode[] }
  | { type: "horizontalRule" }
  | { type: "image"; attrs: { src: string; alt?: string | null } };
export type RichDoc = { type: "doc"; content: RichNode[] };

/** Yalnızca https ve göreli (kendi dosya sunucumuz) bağlantılar; javascript: vb. reddedilir. */
export function isSafeHref(href: string): boolean {
  if (href.startsWith("/") && !href.startsWith("//")) return true;
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:";
  } catch {
    return false;
  }
}

/** Görseller yalnızca kendi dosya adresimizden (`/api/files/...`) veya https (R2 public). */
export function isSafeImageSrc(src: string): boolean {
  if (src.startsWith("/api/files/")) return !src.includes("..");
  try {
    return new URL(src).protocol === "https:";
  } catch {
    return false;
  }
}

const markSchema: z.ZodType<RichMark> = z.union([
  z.object({ type: z.enum(["bold", "italic", "underline", "strike"]) }).transform((m) => ({ type: m.type })),
  z
    .object({ type: z.literal("link"), attrs: z.object({ href: z.string().max(2000).refine(isSafeHref) }).loose() })
    .transform((m) => ({ type: "link" as const, attrs: { href: m.attrs.href } })),
]);

const textSchema = z.object({ type: z.literal("text"), text: z.string().max(20_000), marks: z.array(markSchema).max(5).optional() });
const inlineSchema: z.ZodType<RichInline> = z.union([textSchema, z.object({ type: z.literal("hardBreak") }).transform(() => ({ type: "hardBreak" as const }))]);
const inlines = z.array(inlineSchema).max(2000).optional();

const nodeSchema: z.ZodType<RichNode> = z.lazy(() =>
  z.union([
    z.object({ type: z.literal("paragraph"), content: inlines }),
    z.object({ type: z.literal("heading"), attrs: z.object({ level: z.union([z.literal(1), z.literal(2), z.literal(3)]) }).loose(), content: inlines }).transform((n) => ({
      type: "heading" as const,
      attrs: { level: n.attrs.level },
      ...(n.content ? { content: n.content } : {}),
    })),
    z.object({ type: z.enum(["bulletList", "orderedList", "listItem", "blockquote"]), content: z.array(nodeSchema).max(500) }),
    z.object({ type: z.literal("horizontalRule") }).transform(() => ({ type: "horizontalRule" as const })),
    z
      .object({ type: z.literal("image"), attrs: z.object({ src: z.string().max(1000).refine(isSafeImageSrc), alt: z.string().max(200).nullish() }).loose() })
      .transform((n) => ({ type: "image" as const, attrs: { src: n.attrs.src, alt: n.attrs.alt ?? null } })),
  ]),
);

/** DB'ye yazılmadan önce: yapı + güvenli URL doğrulaması, fazla öznitelikler atılır. */
export const richDocSchema: z.ZodType<RichDoc> = z.object({ type: z.literal("doc"), content: z.array(nodeSchema).max(1000) });

export const EMPTY_DOC: RichDoc = { type: "doc", content: [{ type: "paragraph" }] };

/** DB'den gelen bilinmeyen değeri güvenle doc'a çevirir (geçersizse boş doc). */
export function asRichDoc(value: unknown): RichDoc {
  const parsed = richDocSchema.safeParse(value);
  return parsed.success ? parsed.data : EMPTY_DOC;
}

function inlineText(nodes: RichInline[] | undefined): string {
  return (nodes ?? []).map((n) => (n.type === "text" ? n.text : "\n")).join("");
}

/** Bloklar satırlarla ayrılmış düz metin (önizleme, karakter sayımı, arama). */
export function docToPlainText(doc: RichDoc): string {
  const out: string[] = [];
  const walk = (node: RichNode) => {
    switch (node.type) {
      case "paragraph":
      case "heading":
        out.push(inlineText(node.content));
        break;
      case "image":
      case "horizontalRule":
        break;
      default:
        node.content.forEach(walk);
    }
  };
  doc.content.forEach(walk);
  return out.map((s) => s.trim()).filter(Boolean).join("\n");
}

export function isDocEmpty(doc: RichDoc): boolean {
  return docToPlainText(doc).length === 0 && !doc.content.some((n) => n.type === "image");
}
