"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "./cn";

export type TabItem = { id: string; label: string; content: ReactNode };

/** WAI-ARIA sekmeler: roving tabindex, ←/→/Home/End ile gezinti, otomatik etkinleştirme. */
export function Tabs({ items, label, defaultTab }: { items: TabItem[]; label: string; defaultTab?: string }) {
  const [active, setActive] = useState(defaultTab ?? items[0]?.id);
  const base = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (e: KeyboardEvent) => {
    const index = items.findIndex((t) => t.id === active);
    const map: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: items.length - 1 };
    if (!(e.key in map)) return;
    e.preventDefault();
    const next = items[(map[e.key]! + items.length) % items.length];
    if (!next) return;
    setActive(next.id);
    refs.current[next.id]?.focus();
  };

  return (
    <div className="flex flex-col gap-(--space-4)">
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex gap-(--space-1) overflow-x-auto border-b border-line">
        {items.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.id)}
              className={cn(
                "-mb-px min-h-(--touch-target-min) border-b-(length:--border-width-strong) px-(--space-4) text-(length:--type-body-sm) font-semibold whitespace-nowrap transition-colors duration-(--duration-fast) focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-(--color-focus)",
                selected ? "border-brand text-brand" : "border-transparent text-fg-secondary hover:text-fg",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {items.map((t) => (
        <div key={t.id} role="tabpanel" id={`${base}-panel-${t.id}`} aria-labelledby={`${base}-tab-${t.id}`} hidden={t.id !== active} tabIndex={0}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
