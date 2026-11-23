"use client";

import { useState } from "react";

import { cn } from "./cn";
import { describedBy, Field } from "./field";
import { normalizeOtp } from "./otp";

type OtpInputProps = {
  id: string;
  label: string;
  name?: string;
  length?: number;
  error?: string;
  hint?: string;
  autoFocus?: boolean;
};

/**
 * 6 kutulu kod girişi. Altta TEK gerçek `<input>` vardır (görünmez, kutuların üstünde):
 * yapıştırma, SMS/mail otomatik doldurma (`one-time-code`), ekran okuyucu ve klavye
 * native çalışır; kutular yalnızca görsel.
 */
export function OtpInput({ id, label, name, length = 6, error, hint, autoFocus }: OtpInputProps) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, length - 1);

  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <div className="relative w-full max-w-(--content-width-sm)">
        <input
          id={id}
          name={name ?? id}
          value={value}
          onChange={(e) => setValue(normalizeOtp(e.target.value, length))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern={`\\d{${length}}`}
          maxLength={length}
          required
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, { error, hint })}
          className="absolute inset-0 z-(--z-raised) size-full cursor-text opacity-0"
        />
        <div aria-hidden="true" className="grid gap-(--space-2)" style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}>
          {Array.from({ length }, (_, i) => (
            <div
              key={i}
              className={cn(
                "flex h-(--control-height-lg) items-center justify-center rounded-field border bg-card font-mono text-(length:--type-heading-md) font-semibold text-fg transition-colors duration-(--duration-fast)",
                error ? "border-negative" : "border-line-input",
                focused && i === active && "border-brand outline-(length:--focus-ring-width) outline-(--color-focus)",
              )}
            >
              {value[i] ?? ""}
            </div>
          ))}
        </div>
      </div>
    </Field>
  );
}
