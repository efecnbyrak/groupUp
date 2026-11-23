import type { ReactNode } from "react";

/** Geçici auth kartı (F2). Asıl tasarım F3 — DESIGN §1 Editorial Product. */
export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="w-full max-w-(--content-width-sm) rounded-card border border-line bg-card p-(--space-6) shadow-(--elevation-sm)">
      <h1 className="font-display text-heading-lg font-semibold text-fg">{title}</h1>
      {subtitle ? <p className="mt-(--space-2) text-fg-secondary">{subtitle}</p> : null}
      <div className="mt-(--space-6)">{children}</div>
      {footer ? <div className="mt-(--space-6) text-(length:--type-body-sm) text-fg-secondary">{footer}</div> : null}
    </div>
  );
}

export const linkClass = "text-(--color-link) underline hover:text-(--color-link-hover)";
