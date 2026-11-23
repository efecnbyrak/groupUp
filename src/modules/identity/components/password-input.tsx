"use client";

import { useState } from "react";

import { checkPassword, type PasswordContext, type PasswordRule } from "../password-policy";
import { Field } from "./form-parts";

const RULES: PasswordRule[] = ["length", "letter", "symbol", "allowedChars", "noPersonalInfo"];

export interface PasswordInputLabels {
  label: string;
  show: string;
  hide: string;
  rulesTitle?: string;
  rules?: Record<PasswordRule, string>;
}

/** Göster/gizle + (isteğe bağlı) canlı kural listesi — AUTH-EMAIL §5 arayüz notu. Yapıştırma serbest. */
export function PasswordInput({
  id,
  name,
  labels,
  error,
  autoComplete,
  context,
}: {
  id: string;
  name?: string;
  labels: PasswordInputLabels;
  error?: string;
  autoComplete: "current-password" | "new-password";
  context?: PasswordContext;
}) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  const failed = new Set(checkPassword(value, context));
  const showRules = labels.rules && labels.rulesTitle;

  return (
    <Field id={id} label={labels.label} error={error}>
      <div className="flex gap-(--space-2)">
        <input
          id={id}
          name={name ?? id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={[error ? `${id}-error` : null, showRules ? `${id}-rules` : null].filter(Boolean).join(" ") || undefined}
          className="h-(--control-height-md) w-full rounded-field border border-line-input bg-card px-(--space-3) text-fg outline-none focus-visible:ring-(length:--focus-ring-width) focus-visible:ring-(--color-focus) aria-invalid:border-negative"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-controls={id}
          className="h-(--control-height-md) shrink-0 rounded-control border border-line px-(--space-3) text-(length:--type-body-sm) text-fg-secondary hover:bg-muted"
        >
          {visible ? labels.hide : labels.show}
        </button>
      </div>
      {showRules ? (
        <div id={`${id}-rules`} className="text-(length:--type-caption)">
          <p className="text-fg-secondary">{labels.rulesTitle}</p>
          <ul className="mt-(--space-1)">
            {RULES.map((rule) => {
              const ok = value.length > 0 && !failed.has(rule);
              return (
                <li key={rule} className={ok ? "text-positive" : "text-fg-secondary"}>
                  <span aria-hidden="true">{ok ? "✓" : "✗"}</span> {labels.rules![rule]}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </Field>
  );
}

type RuleKey =
  | "password.rulesTitle"
  | "password.rules.length"
  | "password.rules.letter"
  | "password.rules.symbol"
  | "password.rules.allowedChars"
  | "password.rules.noPersonalInfo";

type LabelSource = Record<"common.show" | "common.hide", string> & Partial<Record<RuleKey, string>>;

/** Etiket sözlüğünden PasswordInput etiketlerini kurar (kurallar yalnızca sözlükte varsa). */
export function passwordLabels(l: LabelSource, label: string, withRules: boolean): PasswordInputLabels {
  const base = { label, show: l["common.show"], hide: l["common.hide"] };
  if (!withRules || !l["password.rulesTitle"]) return base;
  return {
    ...base,
    rulesTitle: l["password.rulesTitle"],
    rules: {
      length: l["password.rules.length"] ?? "",
      letter: l["password.rules.letter"] ?? "",
      symbol: l["password.rules.symbol"] ?? "",
      allowedChars: l["password.rules.allowedChars"] ?? "",
      noPersonalInfo: l["password.rules.noPersonalInfo"] ?? "",
    },
  };
}
