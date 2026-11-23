"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type ComponentProps, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "./cn";

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Açılır panel (disclosure deseni): tetikleyici `aria-expanded` + `aria-controls`.
 * Esc → kapanır ve odak tetikleyiciye döner; dış tık → kapanır; ↑/↓ → öğeler arası gezinti.
 * İçerik serbest (liste, başlık, form) — menü rolü dayatılmaz.
 */
export function Dropdown({
  label,
  trigger,
  triggerClassName,
  align = "end",
  width = "md",
  children,
}: {
  /** Tetikleyicinin erişilebilir adı. */
  label: string;
  trigger: ReactNode;
  triggerClassName?: string;
  align?: "start" | "end";
  width?: "sm" | "md" | "lg";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, close]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      close(true);
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = Array.from(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (!open || items.length === 0) return;
    e.preventDefault();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div ref={root} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-(--space-1) rounded-control focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-offset-(--focus-ring-offset) focus-visible:outline-(--color-focus)",
          triggerClassName,
        )}
      >
        {trigger}
      </button>
      <div
        ref={panel}
        id={id}
        hidden={!open}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) close(false);
        }}
        className={cn(
          "absolute top-full z-(--z-dropdown) mt-(--space-2) max-h-[70vh] overflow-y-auto rounded-overlay border border-line bg-card p-(--space-2) shadow-(--elevation-md)",
          align === "end" ? "right-0" : "left-0",
          width === "sm" && "w-[min(var(--popover-width-sm),calc(100vw-2*var(--gutter)))]",
          width === "md" && "w-[min(var(--popover-width-md),calc(100vw-2*var(--gutter)))]",
          width === "lg" && "w-[min(var(--popover-width-lg),calc(100vw-2*var(--gutter)))]",
        )}
      >
        {children}
      </div>
    </div>
  );
}

const itemClass =
  "flex min-h-(--touch-target-min) w-full items-center gap-(--space-3) rounded-control px-(--space-3) text-left text-(length:--type-body-sm) text-fg hover:bg-muted focus-visible:bg-muted focus-visible:outline-none";

export function DropdownLink({ className, ...rest }: ComponentProps<typeof Link>) {
  return <Link className={cn(itemClass, className)} {...rest} />;
}

export function DropdownButton({ className, type = "button", ...rest }: ComponentProps<"button">) {
  return <button type={type} className={cn(itemClass, className)} {...rest} />;
}

export function DropdownSeparator() {
  return <hr className="my-(--space-1) border-line" />;
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return <p className="px-(--space-3) pt-(--space-2) pb-(--space-1) text-(length:--type-caption) font-semibold text-fg-secondary">{children}</p>;
}
