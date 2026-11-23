"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/components/ui";

const variants = {
  header:
    "relative inline-flex h-full items-center px-(--space-3) text-(length:--type-body-sm) font-semibold text-fg-secondary hover:text-fg aria-[current=page]:text-brand after:absolute after:inset-x-(--space-3) after:bottom-0 after:h-(--border-width-strong) after:bg-transparent aria-[current=page]:after:bg-brand",
  tab: "flex min-h-(--bottom-bar-height) flex-1 flex-col items-center justify-center gap-(--space-0-5) px-(--space-1) text-(length:--font-size-2xs) font-semibold text-fg-secondary aria-[current=page]:text-brand",
  sidebar:
    "flex min-h-(--control-height-md) items-center gap-(--space-3) rounded-control px-(--space-3) text-(length:--type-body-sm) font-semibold text-fg-secondary hover:bg-muted hover:text-fg aria-[current=page]:bg-brand-subtle aria-[current=page]:text-brand",
};

function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact || href === "/") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Aktif sayfayı `aria-current="page"` ile işaretleyen gezinme bağlantısı. */
export function NavLink({ href, icon, children, variant, exact = false, trailing }: { href: string; icon?: ReactNode; children: ReactNode; variant: keyof typeof variants; exact?: boolean; trailing?: ReactNode }) {
  const pathname = usePathname();
  return (
    <Link
      href={href}
      aria-current={isActive(pathname, href, exact) ? "page" : undefined}
      className={cn(
        variants[variant],
        "transition-colors duration-(--duration-fast) focus-visible:outline-(length:--focus-ring-width) focus-visible:-outline-offset-(--focus-ring-width) focus-visible:outline-(--color-focus)",
      )}
    >
      {icon}
      <span>{children}</span>
      {trailing}
    </Link>
  );
}
