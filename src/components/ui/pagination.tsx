import { ChevronRight, ChevronsLeft } from "lucide-react";

import { ButtonLink } from "./button";

/**
 * Cursor sayfalama: "İlk sayfa" + "Sonraki". Geri gitmek için tarayıcı geçmişi yeterli;
 * cursor ile geriye sayfalama bilerek yok (DESIGN: büyük listelerde offset kullanılmaz).
 */
export function Pagination({ firstHref, nextHref, labels }: { firstHref?: string; nextHref?: string; labels: { label: string; first: string; next: string } }) {
  if (!firstHref && !nextHref) return null;
  return (
    <nav aria-label={labels.label} className="flex items-center justify-between gap-(--space-3)">
      {firstHref ? (
        <ButtonLink href={firstHref} variant="ghost" size="sm" icon={<ChevronsLeft aria-hidden="true" className="size-(--icon-size-sm)" />}>
          {labels.first}
        </ButtonLink>
      ) : (
        <span />
      )}
      {nextHref ? (
        <ButtonLink href={nextHref} variant="secondary" size="sm" rel="next">
          {labels.next}
          <ChevronRight aria-hidden="true" className="size-(--icon-size-sm)" />
        </ButtonLink>
      ) : null}
    </nav>
  );
}
