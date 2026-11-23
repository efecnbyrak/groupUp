"use client";

import { useRef, useState } from "react";

import { Button, Checkbox, Input, Select, Textarea, useOptionalToast } from "@/components/ui";
import type { ActionResult } from "@/lib/errors";

import { isFieldVisible, type FieldDef } from "../rules";

export interface DynamicFieldLabels {
  uploadFile: string;
  uploading: string;
  fileSelected: string;
  optional: string;
}

type UploadAction = (prev: ActionResult<{ key: string }> | null, fd: FormData) => Promise<ActionResult<{ key: string }>>;

/** Dinamik form alanı — tipe göre doğru kontrolü render eder. `value`/`onChange` tüm cevap nesnesi üzerinden akar. */
export function DynamicField({
  field,
  answers,
  onChange,
  error,
  eventId,
  uploadAction,
  labels,
}: {
  field: FieldDef;
  answers: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
  error?: string;
  eventId: string;
  uploadAction: UploadAction;
  labels: DynamicFieldLabels;
}) {
  if (!isFieldVisible(field, answers)) return null;
  const value = answers[field.id];
  const id = `rf-${field.id}`;

  if (field.type === "SECTION") {
    return (
      <div className="border-t border-line pt-(--space-4)">
        <h3 className="text-(length:--type-body) font-semibold text-fg">{field.labelTr}</h3>
      </div>
    );
  }

  const label = field.required ? field.labelTr : `${field.labelTr} (${labels.optional})`;

  switch (field.type) {
    case "SHORT_TEXT":
      return <Input id={id} label={label} required={field.required} value={(value as string) ?? ""} onChange={(e) => onChange(field.id, e.target.value)} error={error} maxLength={field.config?.maxLength} />;
    case "LONG_TEXT":
      return <Textarea id={id} label={label} required={field.required} value={(value as string) ?? ""} onChange={(e) => onChange(field.id, e.target.value)} error={error} maxLength={field.config?.maxLength} rows={4} />;
    case "NUMBER":
      return (
        <Input
          id={id}
          type="number"
          label={label}
          required={field.required}
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(field.id, e.target.value === "" ? undefined : Number(e.target.value))}
          error={error}
          min={field.config?.min}
          max={field.config?.max}
        />
      );
    case "DATE":
      return <Input id={id} type="date" label={label} required={field.required} value={(value as string) ?? ""} onChange={(e) => onChange(field.id, e.target.value)} error={error} />;
    case "BOOLEAN":
      return <Checkbox id={id} label={label} checked={Boolean(value)} onChange={(e) => onChange(field.id, e.target.checked)} />;
    case "CONSENT":
      return <Checkbox id={id} label={field.labelTr} checked={Boolean(value)} onChange={(e) => onChange(field.id, e.target.checked)} error={error} />;
    case "SINGLE_CHOICE":
    case "DROPDOWN":
      return (
        <Select
          id={id}
          label={label}
          required={field.required}
          placeholder=""
          options={(field.options ?? []).map((o) => ({ value: o.value, label: o.labelTr }))}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(field.id, e.target.value)}
          error={error}
        />
      );
    case "MULTI_CHOICE": {
      const selected = new Set((value as string[] | undefined) ?? []);
      return (
        <fieldset className="flex flex-col gap-(--space-1)">
          <legend className="text-(length:--type-body-sm) font-semibold text-fg">{label}</legend>
          {(field.options ?? []).map((o) => (
            <Checkbox
              key={o.value}
              id={`${id}-${o.value}`}
              label={o.labelTr}
              checked={selected.has(o.value)}
              onChange={(e) => {
                const next = new Set(selected);
                if (e.target.checked) next.add(o.value);
                else next.delete(o.value);
                onChange(field.id, [...next]);
              }}
            />
          ))}
          {error ? <p className="text-(length:--type-caption) font-semibold text-negative">{error}</p> : null}
        </fieldset>
      );
    }
    case "FILE":
      return (
        <FileField
          id={id}
          label={label}
          required={field.required}
          value={(value as string) ?? ""}
          onChange={(v) => onChange(field.id, v)}
          error={error}
          eventId={eventId}
          accept={field.config?.accept ?? ["pdf", "jpg", "png", "webp"]}
          maxMb={field.config?.maxMb ?? 10}
          uploadAction={uploadAction}
          labels={labels}
        />
      );
  }
}

const EXT_MIME: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

function FileField({
  id,
  label,
  required,
  value,
  onChange,
  error,
  eventId,
  accept,
  maxMb,
  uploadAction,
  labels,
}: {
  id: string;
  label: string;
  required: boolean;
  value: string;
  onChange: (key: string) => void;
  error?: string;
  eventId: string;
  accept: string[];
  maxMb: number;
  uploadAction: UploadAction;
  labels: DynamicFieldLabels;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useOptionalToast();
  return (
    <div className="flex flex-col gap-(--space-2)">
      <p className="text-(length:--type-body-sm) font-semibold text-fg">{label}</p>
      <div className="flex flex-wrap items-center gap-(--space-2)">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={busy}
          loadingLabel={labels.uploading}
          onClick={() => ref.current?.click()}
        >
          {labels.uploadFile}
        </Button>
        {value ? <span className="text-(length:--type-caption) text-fg-secondary">{labels.fileSelected}</span> : null}
      </div>
      <input
        ref={ref}
        type="file"
        hidden
        required={required && !value}
        accept={accept.map((a) => EXT_MIME[a]).join(",")}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          try {
            const fd = new FormData();
            fd.set("eventId", eventId);
            fd.set("fieldId", id);
            fd.set("file", file);
            fd.set("maxMb", String(maxMb));
            fd.set("accept", accept.join(","));
            const res = await uploadAction(null, fd);
            if (res.ok && res.data) onChange(res.data.key);
            else toast?.show(res.ok ? "" : res.error, "danger");
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
      {error ? <p className="text-(length:--type-caption) font-semibold text-negative">{error}</p> : null}
    </div>
  );
}
