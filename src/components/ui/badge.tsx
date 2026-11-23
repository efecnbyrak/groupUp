import type { ComponentProps } from "react";

import { cn } from "./cn";

export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-muted text-fg-secondary",
  brand: "bg-brand-subtle text-brand-active",
  success: "bg-(--color-success-subtle) text-positive",
  warning: "bg-(--color-warning-subtle) text-caution",
  danger: "bg-(--color-danger-subtle) text-negative",
  info: "bg-(--color-info-subtle) text-(--color-info)",
};

/** Durum/etiket rozeti. Renk tek başına anlam taşımaz — metin her zaman var. */
export function Badge({ tone = "neutral", className, ...rest }: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-(--space-1) rounded-badge px-(--space-2) py-(--space-0-5) text-(length:--type-caption) font-semibold whitespace-nowrap",
        tones[tone],
        className,
      )}
      {...rest}
    />
  );
}

/** Sayaç rozeti (bildirim, onay kuyruğu) — ikon düğmesinin köşesine konur. */
export function CountBadge({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null;
  return (
    <span className="absolute top-(--space-1) right-(--space-1) inline-flex min-w-(--space-4) items-center justify-center rounded-badge bg-negative-fill px-(--space-1) text-(length:--font-size-2xs) font-semibold text-(--color-on-danger)">
      <span aria-hidden="true">{count > 99 ? "99+" : count}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
