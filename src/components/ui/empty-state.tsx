import type { ReactNode } from "react";

import { cn } from "./cn";

/** Boş durum: ikon + başlık + açıklama + tek eylem. */
export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-(--space-3) rounded-card border border-dashed border-line-strong px-(--space-6) py-(--space-12) text-center", className)}>
      {icon ? <div className="flex size-(--space-12) items-center justify-center rounded-full bg-muted text-fg-secondary">{icon}</div> : null}
      <h2 className="text-(length:--type-heading-sm) font-semibold text-fg">{title}</h2>
      {description ? <p className="max-w-(--content-width-prose) text-(length:--type-body-sm) text-fg-secondary">{description}</p> : null}
      {action ? <div className="mt-(--space-2)">{action}</div> : null}
    </div>
  );
}
