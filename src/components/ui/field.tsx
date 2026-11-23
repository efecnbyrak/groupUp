import type { ReactNode } from "react";

import { cn } from "./cn";

export const controlClass =
  "w-full rounded-field border border-line-input bg-card px-(--space-3) text-fg placeholder:text-fg-tertiary transition-colors duration-(--duration-fast) hover:border-line-strong focus-visible:border-brand focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-(--color-focus) disabled:cursor-not-allowed disabled:bg-muted disabled:text-(--color-text-disabled) read-only:bg-canvas-subtle aria-invalid:border-negative";

/** Mobilde iOS yakınlaştırmasını önlemek için kontrol metni ≥16px. */
export const controlTextClass = "text-(length:--font-size-md)";

export function describedBy(id: string, opts: { error?: string; hint?: string; extra?: string }): string | undefined {
  const ids = [opts.error ? `${id}-error` : null, opts.hint && !opts.error ? `${id}-hint` : null, opts.extra ?? null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

/** Etiket + kontrol + ipucu/hata. Hata metni `role` almaz; kontrol `aria-describedby` ile bağlanır. */
export function Field({
  id,
  label,
  error,
  hint,
  required,
  className,
  children,
}: {
  id: string;
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-(--space-1-5)", className)}>
      {label ? (
        <div className="flex items-baseline gap-(--space-0-5)">
          <label htmlFor={id} className="text-(length:--type-body-sm) font-semibold text-fg">
            {label}
          </label>
          {/* Yıldız etiketin dışında: erişilebilir ad yalnızca etiket metni olsun (`required` zaten okunur). */}
          {required ? (
            <span aria-hidden="true" className="text-(length:--type-body-sm) font-semibold text-negative">
              *
            </span>
          ) : null}
        </div>
      ) : null}
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-(length:--type-caption) text-fg-secondary">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-(length:--type-caption) font-semibold text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}
