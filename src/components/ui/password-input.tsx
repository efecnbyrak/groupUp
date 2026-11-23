"use client";

import { Check, Eye, EyeOff, X } from "lucide-react";
import { useState, type ComponentProps } from "react";

import { cn } from "./cn";
import { controlClass, controlTextClass, describedBy, Field } from "./field";

export type PasswordRuleState = { id: string; label: string; ok: boolean };

type PasswordInputProps = Omit<ComponentProps<"input">, "type" | "value" | "onChange"> & {
  id: string;
  label: string;
  showLabel: string;
  hideLabel: string;
  error?: string;
  /** Canlı kural listesi başlığı + kurallar (değer → kural durumu). Politika bilgisi çağırandadır. */
  rulesTitle?: string;
  rules?: (value: string) => PasswordRuleState[];
};

/** Göster/gizle düğmeli şifre alanı + isteğe bağlı canlı kural listesi. Yapıştırma serbest. */
export function PasswordInput({ id, label, showLabel, hideLabel, error, rulesTitle, rules, name, required, className, ...rest }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  const ruleStates = rules?.(value);

  return (
    <Field id={id} label={label} error={error} required={required}>
      <div className="relative">
        <input
          id={id}
          name={name ?? id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, { error, extra: ruleStates ? `${id}-rules` : undefined })}
          className={cn(controlClass, controlTextClass, "h-(--control-height-md) pr-(--touch-target-min)", className)}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-controls={id}
          aria-label={visible ? hideLabel : showLabel}
          className="absolute inset-y-0 right-0 inline-flex w-(--touch-target-min) items-center justify-center rounded-control text-fg-secondary hover:text-fg focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-(--color-focus)"
        >
          {visible ? <EyeOff aria-hidden="true" className="size-(--icon-size-md)" /> : <Eye aria-hidden="true" className="size-(--icon-size-md)" />}
        </button>
      </div>
      {ruleStates ? (
        <div id={`${id}-rules`} className="text-(length:--type-caption)">
          {rulesTitle ? <p className="text-fg-secondary">{rulesTitle}</p> : null}
          <ul className="mt-(--space-1) flex flex-col gap-(--space-0-5)">
            {ruleStates.map((rule) => {
              const ok = value.length > 0 && rule.ok;
              return (
                <li key={rule.id} className={cn("flex items-start gap-(--space-1-5)", ok ? "text-positive" : "text-fg-secondary")}>
                  {ok ? (
                    <Check aria-hidden="true" className="mt-(--space-0-5) size-(--icon-size-sm) shrink-0" />
                  ) : (
                    <X aria-hidden="true" className="mt-(--space-0-5) size-(--icon-size-sm) shrink-0" />
                  )}
                  <span>{rule.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </Field>
  );
}
