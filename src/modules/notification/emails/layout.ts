import { createT, type Locale, type Translate } from "@/i18n/messages";

/**
 * Basit, tablosuz, responsive mail iskeleti (AUTH-EMAIL §9). Mail istemcileri CSS
 * değişkenlerini desteklemediği için renkler burada sabit; tasarım tokenlarıyla eşleşir.
 * Tüm değişkenler escapeHtml'den geçer.
 */
export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailBlock =
  | { kind: "p"; text: string }
  | { kind: "code"; text: string }
  | { kind: "button"; text: string; href: string }
  | { kind: "muted"; text: string };

const STYLE = {
  body: "margin:0;padding:24px 12px;background:#f6f7f9;font-family:Inter,Segoe UI,Arial,sans-serif;color:#111827;",
  card: "max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px 24px;",
  brand: "font-size:20px;font-weight:600;margin:0 0 20px;color:#111827;",
  p: "font-size:15px;line-height:1.6;margin:0 0 14px;",
  code: "font-size:30px;letter-spacing:8px;font-weight:600;margin:8px 0 18px;font-family:Consolas,Menlo,monospace;",
  button:
    "display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;margin:4px 0 18px;",
  muted: "font-size:13px;line-height:1.5;color:#6b7280;margin:0 0 12px;",
  footer: "max-width:520px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#6b7280;text-align:center;",
};

function blockHtml(block: EmailBlock): string {
  const text = escapeHtml(block.text);
  switch (block.kind) {
    case "p":
      return `<p style="${STYLE.p}">${text}</p>`;
    case "code":
      return `<p style="${STYLE.code}">${text}</p>`;
    case "button":
      return `<p style="margin:0"><a href="${escapeHtml(block.href)}" style="${STYLE.button}">${text}</a></p><p style="${STYLE.muted}">${escapeHtml(block.href)}</p>`;
    case "muted":
      return `<p style="${STYLE.muted}">${text}</p>`;
  }
}

function blockText(block: EmailBlock): string {
  return block.kind === "button" ? `${block.text}: ${block.href}` : block.text;
}

export function renderEmail(locale: Locale, subject: string, blocks: EmailBlock[]): RenderedEmail {
  const t = createT(locale);
  const footer = t("email.footer");
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="${STYLE.body}"><div style="${STYLE.card}"><p style="${STYLE.brand}">groupUp</p>${blocks.map(blockHtml).join("")}</div><p style="${STYLE.footer}">${escapeHtml(footer)}</p></body></html>`;
  const text = ["groupUp", "", ...blocks.map(blockText), "", "—", footer].join("\n");
  return { subject, html, text };
}

export function translatorFor(locale: Locale): Translate {
  return createT(locale);
}
