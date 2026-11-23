"use client";

import { PasswordInput as UiPasswordInput } from "@/components/ui";

import { checkPassword, type PasswordContext, type PasswordRule } from "../password-policy";

const RULES: PasswordRule[] = ["length", "letter", "symbol", "allowedChars", "noPersonalInfo"];

export interface PasswordInputLabels {
  label: string;
  show: string;
  hide: string;
  rulesTitle?: string;
  rules?: Record<PasswordRule, string>;
}

/** UI PasswordInput + şifre politikası (AUTH-EMAIL §5): kurallar varsa canlı liste gösterilir. */
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
  const ruleLabels = labels.rules;
  return (
    <UiPasswordInput
      id={id}
      name={name}
      label={labels.label}
      showLabel={labels.show}
      hideLabel={labels.hide}
      autoComplete={autoComplete}
      error={error}
      rulesTitle={labels.rulesTitle}
      rules={
        ruleLabels
          ? (value) => {
              const failed = new Set(checkPassword(value, context));
              return RULES.map((rule) => ({ id: rule, label: ruleLabels[rule], ok: !failed.has(rule) }));
            }
          : undefined
      }
    />
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
