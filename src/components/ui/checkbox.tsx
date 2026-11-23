import type { ComponentProps, ReactNode } from "react";

import { cn } from "./cn";
import { describedBy } from "./field";

type CheckboxProps = Omit<ComponentProps<"input">, "type"> & { id: string; label: ReactNode; error?: string; hint?: string };

/** Etiketi tıklanabilir onay kutusu (dokunma hedefi satırın tamamı). */
export function Checkbox({ id, label, error, hint, name, className, ...rest }: CheckboxProps) {
  return (
    <div className={cn("flex flex-col gap-(--space-1)", className)}>
      <label htmlFor={id} className="flex min-h-(--touch-target-min) cursor-pointer items-start gap-(--space-3) py-(--space-2) text-(length:--type-body-sm) text-fg">
        <input
          id={id}
          name={name ?? id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, { error, hint })}
          className="mt-(--space-0-5) size-(--icon-size-sm) shrink-0 cursor-pointer accent-(--color-primary) focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-offset-(--focus-ring-offset) focus-visible:outline-(--color-focus)"
          {...rest}
        />
        <span>{label}</span>
      </label>
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
