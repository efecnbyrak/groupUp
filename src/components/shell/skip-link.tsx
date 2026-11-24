import { getT } from "@/i18n/server";

/**
 * WCAG 2.4.1 (Bypass Blocks): klavye kullanıcısı header'ı atlayıp `#icerik`'e gider.
 * Kendi Suspense sınırı içinde kullanılmalı: `getT` dinamik veri okur (cookie), layout'u
 * statik dışa çıkarmasın diye (cacheComponents).
 */
export async function SkipLink({ targetId = "icerik" }: { targetId?: string }) {
  const t = await getT();
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-(--space-2) focus-visible:left-(--space-2) focus-visible:z-(--z-header) focus-visible:rounded-control focus-visible:bg-card focus-visible:px-(--space-4) focus-visible:py-(--space-2) focus-visible:text-(length:--type-body-sm) focus-visible:font-semibold focus-visible:text-fg focus-visible:shadow-(--elevation-md) focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-(--color-focus)"
    >
      {t("common.skipToContent")}
    </a>
  );
}
