"use client";

import { X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

import { cn } from "./cn";

type ToastTone = "neutral" | "success" | "danger";
type ToastItem = { id: number; message: string; tone: ToastTone };
type ToastApi = { show: (message: string, tone?: ToastTone) => void };

const ToastContext = createContext<ToastApi | null>(null);
const DURATION_MS = 5000;

/** Toast sağlayıcısı: `aria-live="polite"` bölgesi, 5 sn sonra kapanır, en fazla 3 görünür. */
export function ToastProvider({ closeLabel, children }: { closeLabel: string; children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const show = useCallback(
    (message: string, tone: ToastTone = "neutral") => {
      const id = nextId.current++;
      setItems((list) => [...list.slice(-2), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-(--space-4) z-(--z-toast) flex flex-col items-center gap-(--space-2) px-(--gutter) pb-[env(safe-area-inset-bottom)] lg:right-(--space-6) lg:left-auto lg:items-end"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "danger" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-(--popover-width-lg) items-center gap-(--space-3) rounded-overlay py-(--space-2) pr-(--space-2) pl-(--space-4) text-(length:--type-body-sm) shadow-(--elevation-lg)",
              t.tone === "danger" ? "bg-negative-fill text-(--color-on-danger)" : "bg-inverse text-(--color-text-inverse)",
            )}
          >
            <p className="flex-1">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label={closeLabel}
              className="inline-flex size-(--touch-target-min) shrink-0 items-center justify-center rounded-control opacity-80 hover:opacity-100 focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-current"
            >
              <X aria-hidden="true" className="size-(--icon-size-sm)" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast: ToastProvider gerekli");
  return ctx;
}
