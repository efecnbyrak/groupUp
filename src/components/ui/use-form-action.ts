"use client";

import { useActionState, useTransition, type FormEvent } from "react";

import type { ActionResult } from "@/lib/errors";

export type FormAction<T> = (prev: ActionResult<T> | null, formData: FormData) => Promise<ActionResult<T>>;

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
