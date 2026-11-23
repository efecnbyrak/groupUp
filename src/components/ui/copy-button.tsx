"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "./button";

/** Panoya kopyala (davet linki/kodu). Başarı metni ekran okuyuculara duyurulur. */
export function CopyButton({ value, label, copiedLabel }: { value: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      icon={copied ? <Check aria-hidden="true" className="size-(--icon-size-sm)" /> : <Copy aria-hidden="true" className="size-(--icon-size-sm)" />}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
    >
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </Button>
  );
}
