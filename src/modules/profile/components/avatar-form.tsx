"use client";

import { Camera } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Avatar, Button, FormMessage, useFormAction } from "@/components/ui";

import { removeAvatarAction, uploadAvatarAction } from "../actions";

export type AvatarFormLabels = { choose: string; upload: string; remove: string; hint: string; loading: string };

/** Avatar seç → önizle → yükle; mevcut avatarı kaldır. Dönüştürme sunucuda (sharp). */
export function AvatarForm({ name, currentUrl, labels }: { name: string; currentUrl: string | null; labels: AvatarFormLabels }) {
  const upload = useFormAction(uploadAvatarAction);
  const remove = useFormAction(removeAvatarAction);
  // Önizleme, seçildiği andaki sonuca bağlıdır: yeni bir yükleme sonucu gelince kendiliğinden düşer.
  const [selected, setSelected] = useState<{ url: string; after: unknown } | null>(null);
  const preview = selected && selected.after === upload.state ? selected.url : null;
  const inputId = useId();

  useEffect(() => () => (selected ? URL.revokeObjectURL(selected.url) : undefined), [selected]);

  return (
    <div className="flex flex-col gap-(--space-4)">
      <FormMessage state={upload.state ?? remove.state} />
      <div className="flex flex-col items-start gap-(--space-4) sm:flex-row sm:items-center">
        <Avatar name={name} src={preview ?? currentUrl} size="lg" />
        <div className="flex flex-col gap-(--space-2)">
          <div className="flex flex-wrap gap-(--space-3)">
            <form onSubmit={upload.onSubmit} className="flex flex-wrap gap-(--space-3)" noValidate>
              <label
                htmlFor={inputId}
                className="inline-flex min-h-(--control-height-md) cursor-pointer items-center gap-(--space-2) rounded-control border border-line-strong bg-card px-(--space-4) text-(length:--type-body-sm) font-semibold text-fg focus-within:outline-(length:--focus-ring-width) focus-within:outline-(--color-focus) hover:bg-muted"
              >
                <Camera aria-hidden="true" className="size-(--icon-size-sm)" />
                {labels.choose}
                <input
                  id={inputId}
                  name="avatar"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  aria-describedby={`${inputId}-hint`}
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    setSelected(file ? { url: URL.createObjectURL(file), after: upload.state } : null);
                  }}
                />
              </label>
              {preview ? (
                <Button type="submit" loading={upload.pending} loadingLabel={labels.loading}>
                  {labels.upload}
                </Button>
              ) : null}
            </form>
            {currentUrl && !preview ? (
              <form onSubmit={remove.onSubmit}>
                <Button type="submit" variant="ghost" loading={remove.pending} loadingLabel={labels.loading}>
                  {labels.remove}
                </Button>
              </form>
            ) : null}
          </div>
          <p id={`${inputId}-hint`} className="text-(length:--type-caption) text-fg-secondary">
            {labels.hint}
          </p>
        </div>
      </div>
    </div>
  );
}
