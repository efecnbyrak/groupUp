import type { ReactNode } from "react";

import { Card } from "@/components/ui";

/** Auth kartı (Editorial): tek sütun, en fazla 640px, başlık + alt metin + form + alt bağlantılar. */
export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <Card padding="lg" elevated className="w-full max-w-(--content-width-sm)">
      <h1 className="font-display text-heading-lg font-semibold text-fg">{title}</h1>
      {subtitle ? <p className="mt-(--space-2) text-fg-secondary">{subtitle}</p> : null}
      <div className="mt-(--space-6)">{children}</div>
      {footer ? <div className="mt-(--space-6) border-t border-line pt-(--space-6) text-(length:--type-body-sm) text-fg-secondary">{footer}</div> : null}
    </Card>
  );
}

export const linkClass = "font-semibold text-(--color-link) underline-offset-4 hover:text-(--color-link-hover) hover:underline";
