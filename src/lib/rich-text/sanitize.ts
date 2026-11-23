import "server-only";

import sanitizeHtml from "sanitize-html";

import { asRichDoc, isSafeImageSrc } from "./doc";
import { docToHtml } from "./html";

/** Görüntüleyicinin kabul ettiği tek HTML kümesi (CLAUDE.md §5: kullanıcı HTML'i yalnızca sanitize sonrası). */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "h1", "h2", "h3", "strong", "em", "u", "s", "a", "ul", "ol", "li", "blockquote", "hr", "br", "img", "span"],
  allowedAttributes: { a: ["href", "rel", "target"], img: ["src", "alt", "loading"] },
  allowedSchemes: ["https", "http", "mailto"],
  allowedSchemesByTag: { img: ["https"] },
  allowProtocolRelative: false,
  exclusiveFilter: (frame) => frame.tag === "img" && !isSafeImageSrc(frame.attribs.src ?? ""),
  transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }) },
};

export function sanitizeRichHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}

/** DB'deki Tiptap JSON → güvenli HTML (`RichText` bileşenine verilir). */
export function renderRichText(value: unknown): string {
  return sanitizeRichHtml(docToHtml(asRichDoc(value)));
}
