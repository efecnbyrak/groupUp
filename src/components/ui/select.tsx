import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "./cn";
import { controlClass, controlTextClass, describedBy, Field } from "./field";

/** `group` verilirse ardışık aynı gruptaki seçenekler `<optgroup>` içinde gösterilir. */
export type SelectOption = { value: string; label: string; group?: string };

type SelectProps = ComponentProps<"select"> & {
  id: string;
  label?: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  options: SelectOption[];
};

/** Native select (mobilde sistem seçicisi, klavye/ekran okuyucu ücretsiz) + özel ok ikonu. */
export function Select({ id, label, error, hint, placeholder, options, name, className, required, ...rest }: SelectProps) {
  return (
    <Field id={id} label={label} error={error} hint={hint} required={required}>
      <div className="relative">
        <select
          id={id}
          name={name ?? id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, { error, hint })}
          className={cn(controlClass, controlTextClass, "h-(--control-height-md) appearance-none pr-(--space-10)", className)}
          {...rest}
        >
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {groupOptions(options).map((g, i) =>
            g.group === undefined ? (
              g.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))
            ) : (
              <optgroup key={`${g.group}-${i}`} label={g.group}>
                {g.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ),
          )}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-(--space-3) size-(--icon-size-sm) -translate-y-1/2 text-fg-secondary"
        />
      </div>
    </Field>
  );
}

/** Ardışık aynı `group` değerine sahip seçenekleri bir araya toplar (saf; test edilir). */
export function groupOptions(options: SelectOption[]): { group?: string; options: SelectOption[] }[] {
  const out: { group?: string; options: SelectOption[] }[] = [];
  for (const o of options) {
    const last = out[out.length - 1];
    if (last && last.group === o.group) last.options.push(o);
    else out.push({ group: o.group, options: [o] });
  }
  return out;
}
