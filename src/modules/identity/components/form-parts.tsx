"use client";

import { useActionState, useTransition, type FormEvent, type ReactNode } from "react";

import type { ActionResult } from "@/lib/errors";

/**
 * Geçici form parçaları (F2). F3'te `src/components/ui` (Input, Select, Button...) ile değişir.
 * Yalnızca token sınıfları kullanılır.
 */

type FormAction<T> = (prev: ActionResult<T> | null, formData: FormData) => Promise<ActionResult<T>>;

/**
 * `useActionState` + onSubmit: React'in başarılı action sonrası formu sıfırlamasını engeller,
 * böylece hata durumunda kullanıcının girdiği değerler korunur.
 */
export function useFormAction<T>(action: FormAction<T>) {
  const [state, dispatch, pending] = useActionState(action, null);
  const [, startTransition] = useTransition();
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  };
  return { state, onSubmit, pending, fieldError: (name: string) => (state && !state.ok ? state.fieldErrors?.[name] : undefined) };
}

const controlClass =
  "h-(--control-height-md) w-full rounded-field border border-line-input bg-card px-(--space-3) text-fg outline-none focus-visible:ring-(length:--focus-ring-width) focus-visible:ring-(--color-focus) aria-invalid:border-negative";

export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-(--space-1-5)">
      <label htmlFor={id} className="font-semibold text-(length:--type-body-sm) text-fg">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-(length:--type-caption) text-fg-secondary">{hint}</p> : null}
      {error ? (
        <p id={`${id}-error`} className="text-(length:--type-caption) text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; error?: string; hint?: string };

export function TextField({ id, label, error, hint, name, ...rest }: InputProps) {
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <input
        id={id}
        name={name ?? id}
        className={controlClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...rest}
      />
    </Field>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  label: string;
  error?: string;
  placeholder: string;
  options: { value: string; label: string }[];
};

export function SelectField({ id, label, error, placeholder, options, name, ...rest }: SelectProps) {
  return (
    <Field id={id} label={label} error={error}>
      <select
        id={id}
        name={name ?? id}
        className={controlClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...rest}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function SubmitButton({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="h-(--control-height-lg) w-full rounded-control bg-brand px-(--space-4) font-semibold text-on-brand hover:bg-brand-hover disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionResult<unknown> | null }) {
  if (!state) return null;
  if (state.ok) {
    return state.message ? (
      <p role="status" className="rounded-control bg-(--color-success-subtle) p-(--space-3) text-(length:--type-body-sm) text-fg">
        {state.message}
      </p>
    ) : null;
  }
  return (
    <p role="alert" className="rounded-control bg-(--color-danger-subtle) p-(--space-3) text-(length:--type-body-sm) text-fg">
      {state.error}
    </p>
  );
}
