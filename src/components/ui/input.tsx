import type { ComponentProps } from "react";

import { cn } from "./cn";
import { controlClass, controlTextClass, describedBy, Field } from "./field";

type FieldProps = { id: string; label?: string; error?: string; hint?: string };

/** Etiketli metin girişi. `name` verilmezse `id` kullanılır. */
export function Input({ id, label, error, hint, name, className, required, ...rest }: ComponentProps<"input"> & FieldProps) {
  return (
    <Field id={id} label={label} error={error} hint={hint} required={required}>
      <input
        id={id}
        name={name ?? id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, { error, hint })}
        className={cn(controlClass, controlTextClass, "h-(--control-height-md)", className)}
        {...rest}
      />
    </Field>
  );
}

export function Textarea({ id, label, error, hint, name, className, required, rows = 4, ...rest }: ComponentProps<"textarea"> & FieldProps) {
  return (
    <Field id={id} label={label} error={error} hint={hint} required={required}>
      <textarea
        id={id}
        name={name ?? id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, { error, hint })}
        className={cn(controlClass, controlTextClass, "py-(--space-2) leading-(--line-height-normal)", className)}
        {...rest}
      />
    </Field>
  );
}
