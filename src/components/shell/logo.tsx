import Link from "next/link";

/** groupUp işareti: üç kesişen daire (grup). Renk `currentColor` → bulunduğu panelin rengi. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="8" className="fill-brand" />
      <circle cx="12" cy="13" r="5" className="fill-none stroke-(--color-on-primary)" strokeWidth="2.5" />
      <circle cx="20" cy="13" r="5" className="fill-none stroke-(--color-on-primary)" strokeWidth="2.5" />
      <circle cx="16" cy="20" r="5" className="fill-none stroke-(--color-on-primary)" strokeWidth="2.5" />
    </svg>
  );
}

export function Logo({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex min-h-(--touch-target-min) shrink-0 items-center gap-(--space-2) rounded-control font-display text-(length:--type-heading-sm) font-semibold text-fg focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-offset-(--focus-ring-offset) focus-visible:outline-(--color-focus)"
    >
      <LogoMark className="size-(--control-height-sm)" />
      <span aria-hidden="true">groupUp</span>
    </Link>
  );
}
