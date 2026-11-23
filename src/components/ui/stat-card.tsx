import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "./cn";

/** Genel bakış sayacı: etiket + büyük sayı (+ isteğe bağlı bağlantı). */
export function StatCard({ label, value, hint, href, icon }: { label: string; value: number | string; hint?: string; href?: string; icon?: ReactNode }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-(--space-2)">
        <p className="text-(length:--type-body-sm) font-medium text-fg-secondary">{label}</p>
        {icon ? <span className="text-brand">{icon}</span> : null}
      </div>
      <p className="text-(length:--type-heading-xl) font-semibold tabular-nums text-fg">{value}</p>
      {hint ? <p className="text-(length:--type-caption) text-fg-secondary">{hint}</p> : null}
    </>
  );
  const cls = "flex flex-col gap-(--space-2) rounded-card border border-line bg-card p-(--space-5)";
  return href ? (
    <Link href={href} className={cn(cls, "hover:border-line-strong focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-(--color-focus)")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
