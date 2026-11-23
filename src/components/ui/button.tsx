import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex shrink-0 select-none items-center justify-center gap-(--space-2) whitespace-nowrap rounded-control font-semibold transition-colors duration-(--duration-fast) ease-(--easing-standard) focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-offset-(--focus-ring-offset) focus-visible:outline-(--color-focus) disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:pointer-events-none aria-disabled:opacity-60";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-on-brand hover:bg-brand-hover active:bg-brand-active",
  secondary: "border border-line-strong bg-card text-fg hover:bg-muted active:bg-canvas-subtle",
  ghost: "text-fg hover:bg-muted active:bg-canvas-subtle",
  danger: "bg-negative-fill text-(--color-on-danger) hover:opacity-90 active:opacity-80",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-(--control-height-sm) px-(--space-3) text-(length:--type-body-sm)",
  md: "h-(--control-height-md) px-(--space-4) text-(length:--type-body-sm)",
  lg: "h-(--control-height-lg) px-(--space-6) text-(length:--type-body)",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  block = false,
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; className?: string } = {}): string {
  return cn(base, variants[variant], sizes[size], block && "w-full", className);
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-(--icon-size-sm) animate-spin rounded-full border-(length:--border-width-strong) border-current border-t-transparent motion-reduce:animate-none"
    />
  );
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  /** Yükleme sırasında gösterilen metin (ekran okuyucu dahil). */
  loadingLabel?: string;
  icon?: ReactNode;
};

/** Birincil/ikincil/hayalet/tehlike düğmesi. `loading` → disabled + aria-busy + spinner. */
export function Button({ variant, size, block, loading, loadingLabel, icon, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, block, className })}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; icon?: ReactNode };

/** Düğme görünümlü bağlantı (gezinme = link, eylem = button). */
export function ButtonLink({ variant, size, block, icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, block, className })} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
