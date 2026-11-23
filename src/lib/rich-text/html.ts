/**
 * Doc → HTML (görüntüleme) ve çeviri için blok içi HTML gidiş-dönüşü. Saf TS.
 * Çıktı ayrıca `sanitize-html`'den geçirilir (`sanitize.ts`); burada da her metin kaçışlanır.
 */
import { isSafeHref, isSafeImageSrc, type RichDoc, type RichInline, type RichMark, type RichNode, type RichText } from "./doc";

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const MARK_TAG: Record<Exclude<RichMark["type"], "link">, string> = { bold: "strong", italic: "em", underline: "u", strike: "s" };

function openMark(m: RichMark): string {
  if (m.type === "link") return isSafeHref(m.attrs.href) ? `<a href="${escapeHtml(m.attrs.href)}" rel="noopener noreferrer nofollow" target="_blank">` : "<span>";
  return `<${MARK_TAG[m.type]}>`;
}
function closeMark(m: RichMark): string {
  if (m.type === "link") return isSafeHref(m.attrs.href) ? "</a>" : "</span>";
  return `</${MARK_TAG[m.type]}>`;
}

/** Blok içi düğümler → HTML (her metin düğümünün işaretleri ayrı ayrı açılıp kapanır). */
export function inlineToHtml(nodes: RichInline[] | undefined): string {
  return (nodes ?? [])
    .map((n) => {
      if (n.type === "hardBreak") return "<br>";
      const marks = n.marks ?? [];
      return marks.map(openMark).join("") + escapeHtml(n.text) + [...marks].reverse().map(closeMark).join("");
    })
    .join("");
}

function nodeToHtml(node: RichNode): string {
  switch (node.type) {
    case "paragraph":
      return `<p>${inlineToHtml(node.content)}</p>`;
    case "heading":
      return `<h${node.attrs.level}>${inlineToHtml(node.content)}</h${node.attrs.level}>`;
    case "bulletList":
      return `<ul>${node.content.map(nodeToHtml).join("")}</ul>`;
    case "orderedList":
      return `<ol>${node.content.map(nodeToHtml).join("")}</ol>`;
    case "listItem":
      return `<li>${node.content.map(nodeToHtml).join("")}</li>`;
    case "blockquote":
      return `<blockquote>${node.content.map(nodeToHtml).join("")}</blockquote>`;
    case "horizontalRule":
      return "<hr>";
    case "image":
      return isSafeImageSrc(node.attrs.src) ? `<img src="${escapeHtml(node.attrs.src)}" alt="${escapeHtml(node.attrs.alt ?? "")}" loading="lazy">` : "";
  }
}

export function docToHtml(doc: RichDoc): string {
  return doc.content.map(nodeToHtml).join("");
}

// ---------------------------------------------------------------- Çeviri gidiş-dönüşü

const TAG_TO_MARK: Record<string, RichMark["type"]> = { strong: "bold", b: "bold", em: "italic", i: "italic", u: "underline", s: "strike" };

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

/**
 * `inlineToHtml` çıktısının (çeviri servisinden dönen hali) tersine çevrilmesi. Yalnızca bizim
 * ürettiğimiz etiketler tanınır; bilinmeyen etiketler atılır, metni korunur.
 */
export function htmlToInline(html: string): RichInline[] {
  const out: RichInline[] = [];
  const stack: RichMark[] = [];
  const re = /<\s*(\/)?\s*([a-zA-Z]+)([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [, closing, rawTag, attrs, text] = m;
    if (text !== undefined) {
      const value = decodeEntities(text);
      if (!value) continue;
      const node: RichText = { type: "text", text: value };
      if (stack.length) node.marks = stack.map((mk) => ({ ...mk }));
      const prev = out[out.length - 1];
      if (prev?.type === "text" && JSON.stringify(prev.marks ?? []) === JSON.stringify(node.marks ?? [])) prev.text += value;
      else out.push(node);
      continue;
    }
    const tag = rawTag!.toLowerCase();
    if (tag === "br") {
      out.push({ type: "hardBreak" });
      continue;
    }
    const markType = tag === "a" ? "link" : TAG_TO_MARK[tag];
    if (!markType) continue;
    if (closing) {
      const idx = stack.map((s) => s.type).lastIndexOf(markType);
      if (idx >= 0) stack.splice(idx, 1);
      continue;
    }
    if (markType === "link") {
      const href = /href\s*=\s*"([^"]*)"/i.exec(attrs ?? "")?.[1];
      const decoded = href ? decodeEntities(href) : "";
      if (decoded && isSafeHref(decoded)) stack.push({ type: "link", attrs: { href: decoded } });
      else stack.push({ type: "link", attrs: { href: "" } }); // kapanışla eşleşsin; aşağıda temizlenir
      continue;
    }
    stack.push({ type: markType } as RichMark);
  }
  for (const n of out) {
    if (n.type === "text" && n.marks) {
      n.marks = n.marks.filter((mk) => mk.type !== "link" || mk.attrs.href !== "");
      if (!n.marks.length) delete n.marks;
    }
  }
  return out;
}

/** Çevrilecek metin blokları (paragraf/başlık); sıra `applyTranslatedBlocks` ile aynıdır. */
export function collectTextBlocks(doc: RichDoc): string[] {
  const out: string[] = [];
  const walk = (node: RichNode) => {
    if (node.type === "paragraph" || node.type === "heading") {
      if (node.content?.length) out.push(inlineToHtml(node.content));
    } else if (node.type === "image") {
      if (node.attrs.alt) out.push(escapeHtml(node.attrs.alt));
    } else if (node.type !== "horizontalRule") node.content.forEach(walk);
  };
  doc.content.forEach(walk);
  return out;
}

/** Çevrilmiş blokları aynı sırayla yerine koyar (yeni doc döner, girdi değişmez). */
export function applyTranslatedBlocks(doc: RichDoc, translated: readonly string[]): RichDoc {
  let i = 0;
  const next = () => translated[i++] ?? "";
  const map = (node: RichNode): RichNode => {
    switch (node.type) {
      case "paragraph":
      case "heading":
        return node.content?.length ? { ...node, content: htmlToInline(next()) } : node;
      case "image":
        return node.attrs.alt ? { ...node, attrs: { ...node.attrs, alt: decodeEntities(next()).replace(/<[^>]*>/g, "") } } : node;
      case "horizontalRule":
        return node;
      default:
        return { ...node, content: node.content.map(map) };
    }
  };
  return { type: "doc", content: doc.content.map(map) };
}
