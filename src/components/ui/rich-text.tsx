import { cn } from "./cn";

/**
 * Zengin metin görüntüleyici. `sanitizedHtml` YALNIZCA sunucuda `renderRichText()` (sanitize-html)
 * çıktısı olmalıdır (CLAUDE.md §5). Ham kullanıcı HTML'i buraya verilmez.
 */
export function RichText({ sanitizedHtml, className, lang }: { sanitizedHtml: string; className?: string; lang?: string }) {
  return <div lang={lang} className={cn("rich-text", className)} dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />;
}
