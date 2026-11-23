"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { FormMessage } from "./alert";
import { Button, type ButtonVariant } from "./button";
import { Checkbox } from "./checkbox";
import { cn } from "./cn";
import { Input, Textarea } from "./input";
import { Modal } from "./modal";
import { Select, type SelectOption } from "./select";
import { useOptionalToast } from "./toast";
import { useFormAction, type FormAction } from "./use-form-action";

type Base = { name: string; label: string; hint?: string; required?: boolean };

/** Sunucudan prop olarak gelen form alanı tanımı (metinler çevrilmiş). */
export type FormField =
  | (Base & {
      type: "text" | "email" | "number" | "tel" | "date" | "password" | "url";
      defaultValue?: string;
      placeholder?: string;
      autoComplete?: string;
      maxLength?: number;
      min?: number;
      max?: number;
    })
  | (Base & { type: "textarea"; defaultValue?: string; rows?: number; maxLength?: number })
  | (Base & { type: "select"; options: SelectOption[]; defaultValue?: string; placeholder?: string })
  | (Base & { type: "checkbox"; defaultChecked?: boolean })
  | (Base & { type: "file"; accept: string; multiple?: boolean })
  | { type: "hidden"; name: string; value: string };

export type ActionFormProps = {
  action: FormAction<undefined>;
  fields: FormField[];
  submitLabel: string;
  loadingLabel: string;
  /** Başarıdan sonra alanları temizle (ekleme formları). */
  resetOnSuccess?: boolean;
  /** "inline": geniş ekranda alanlar ve düğme tek satır (kısa ekleme formları). */
  layout?: "stack" | "inline";
  submitVariant?: ButtonVariant;
  /** Başarıda çağrılır (sunucu mesajıyla). */
  onSuccess?: (message?: string) => void;
  footer?: ReactNode;
};

export function ActionForm({ action, fields, submitLabel, loadingLabel, resetOnSuccess, layout = "stack", submitVariant, onSuccess, footer }: ActionFormProps) {
  const form = useFormAction(action);
  const ref = useRef<HTMLFormElement>(null);
  const prefix = useId();
  const handled = useRef<unknown>(null);

  useEffect(() => {
    if (form.state?.ok && handled.current !== form.state) {
      handled.current = form.state;
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.(form.state.message);
    }
  }, [form.state, resetOnSuccess, onSuccess]);

  const inline = layout === "inline";
  return (
    <form ref={ref} onSubmit={form.onSubmit} noValidate className="flex flex-col gap-(--space-4)">
      <FormMessage state={form.state} />
      {fields.map((f) => (f.type === "hidden" ? <input key={f.name} type="hidden" name={f.name} value={f.value} /> : null))}
      <div className={cn("flex flex-col gap-(--space-4)", inline && "sm:flex-row sm:flex-wrap sm:items-end")}>
        {fields.map((f) =>
          f.type === "hidden" ? null : (
            <div key={f.name} className={cn(inline && "sm:min-w-0 sm:flex-1")}>
              {renderField(f, `${prefix}-${f.name}`, form.fieldError(f.name))}
            </div>
          ),
        )}
        <div className={cn("flex flex-wrap gap-(--space-3)")}>
          <Button type="submit" variant={submitVariant} loading={form.pending} loadingLabel={loadingLabel}>
            {submitLabel}
          </Button>
          {footer}
        </div>
      </div>
    </form>
  );
}

function renderField(f: FormField, id: string, error: string | undefined) {
  switch (f.type) {
    case "hidden":
      return null;
    case "textarea":
      return <Textarea id={id} name={f.name} label={f.label} hint={f.hint} required={f.required} error={error} defaultValue={f.defaultValue} rows={f.rows} maxLength={f.maxLength} />;
    case "select":
      return (
        <Select id={id} name={f.name} label={f.label} hint={f.hint} required={f.required} error={error} options={f.options} defaultValue={f.defaultValue} placeholder={f.placeholder} />
      );
    case "checkbox":
      return <Checkbox id={id} name={f.name} value="on" label={f.label} hint={f.hint} error={error} defaultChecked={f.defaultChecked} />;
    case "file":
      return (
        <Input
          id={id}
          name={f.name}
          type="file"
          label={f.label}
          hint={f.hint}
          required={f.required}
          error={error}
          accept={f.accept}
          multiple={f.multiple}
          className="py-(--space-2) file:mr-(--space-3) file:rounded-control file:border-0 file:bg-muted file:px-(--space-3) file:py-(--space-1) file:text-fg"
        />
      );
    default:
      return (
        <Input
          id={id}
          name={f.name}
          type={f.type}
          label={f.label}
          hint={f.hint}
          required={f.required}
          error={error}
          defaultValue={f.defaultValue}
          placeholder={f.placeholder}
          autoComplete={f.autoComplete}
          maxLength={f.maxLength}
          min={f.min}
          max={f.max}
        />
      );
  }
}

/** Düğme → modal içinde form; başarıda kapanır (düzenleme/ekleme diyalogları). */
export function ActionDialog({
  triggerLabel,
  triggerVariant = "secondary",
  triggerSize = "sm",
  title,
  description,
  closeLabel,
  ...formProps
}: ActionFormProps & {
  triggerLabel: string;
  triggerVariant?: ButtonVariant;
  triggerSize?: "sm" | "md";
  title: string;
  description?: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  const toast = useOptionalToast();
  return (
    <>
      <Button
        variant={triggerVariant}
        size={triggerSize}
        onClick={() => {
          setKey((k) => k + 1);
          setOpen(true);
        }}
      >
        {triggerLabel}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} description={description} closeLabel={closeLabel}>
        <ActionForm
          key={key}
          {...formProps}
          onSuccess={(message) => {
            setOpen(false);
            // Dialog kapanınca içindeki mesaj görünmez → toast ile duyurulur.
            if (message) toast?.show(message, "success");
          }}
        />
      </Modal>
    </>
  );
}

/** Onay gerektiren tek tık eylemi (sil, kaldır, reddet). Değerler gizli alan olarak gider. */
export function ConfirmAction({
  action,
  values,
  triggerLabel,
  title,
  description,
  confirmLabel,
  cancelLabel,
  closeLabel,
  loadingLabel,
  variant = "danger",
}: {
  action: FormAction<undefined>;
  values: Record<string, string>;
  triggerLabel: string;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  closeLabel: string;
  loadingLabel: string;
  variant?: ButtonVariant;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  const toast = useOptionalToast();
  return (
    <>
      <Button
        variant={variant === "danger" ? "ghost" : variant === "primary" ? "primary" : "secondary"}
        size="sm"
        className={variant === "danger" ? "text-negative" : undefined}
        onClick={() => {
          setKey((k) => k + 1);
          setOpen(true);
        }}
      >
        {triggerLabel}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} description={description} closeLabel={closeLabel}>
        <ActionForm
          key={key}
          action={action}
          fields={Object.entries(values).map(([name, value]) => ({ type: "hidden" as const, name, value }))}
          submitLabel={confirmLabel}
          submitVariant={variant}
          loadingLabel={loadingLabel}
          onSuccess={(message) => {
            setOpen(false);
            if (message) toast?.show(message, "success");
          }}
          footer={
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {cancelLabel}
            </Button>
          }
        />
      </Modal>
    </>
  );
}
