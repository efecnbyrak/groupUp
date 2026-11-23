import type { ComponentProps, ReactNode } from "react";

import { cn } from "./cn";

type IconButtonProps = Omit<ComponentProps<"button">, "children"> & {
  /** Erişilebilir ad — ikon düğmelerinde zorunlu. */
  label: string;
  icon: ReactNode;
  badge?: ReactNode;
};

/** Yalnızca ikonlu düğme: 44px dokunma hedefi, görünür odak, zorunlu `aria-label`. */
export function IconButton({ label, icon, badge, className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex size-(--touch-target-min) shrink-0 items-center justify-center rounded-control text-fg-secondary transition-colors duration-(--duration-fast) hover:bg-muted hover:text-fg focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-offset-(--focus-ring-offset) focus-visible:outline-(--color-focus) disabled:opacity-60",
        className,
      )}
      {...rest}
    >
      {icon}
      {badge}
    </button>
  );
}
