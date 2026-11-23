"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALES, type Locale } from "@/i18n/config";

import { cn } from "./cn";

/** Tercihi cookie'ye yazar (bileşen dışında: global DOM yazımı render saflığını bozmasın). */
function persistLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
  document.documentElement.lang = locale;
}

/**
 * TR | EN seçici. Tercih `gu_locale` cookie'sine yazılır ve sayfa sunucudan yenilenir
 * (URL değişmez). Sunucu tarafı yetki/veri yok → server action gerekmez.
 */
export function LocaleSwitcher({ current, label, names, className }: { current: Locale; label: string; names: Record<Locale, string>; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const choose = (locale: Locale) => {
    if (locale === current) return;
    persistLocale(locale);
    startTransition(() => router.refresh());
  };

  return (
    <div role="group" aria-label={label} aria-busy={pending || undefined} className={cn("inline-flex rounded-control border border-line p-(--space-0-5)", className)}>
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-pressed={locale === current}
          aria-label={names[locale]}
          onClick={() => choose(locale)}
          className={cn(
            "min-h-(--control-height-sm) min-w-(--control-height-sm) rounded-control px-(--space-2) text-(length:--type-caption) font-semibold uppercase transition-colors duration-(--duration-fast) focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-(--color-focus)",
            locale === current ? "bg-inverse text-(--color-text-inverse)" : "text-fg-secondary hover:text-fg",
          )}
        >
          {locale}
        </button>
      ))}
    </div>
  );
}
