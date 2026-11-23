import Link from "next/link";

import { LocaleSwitcher } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";

import { LogoMark } from "./logo";

/** Directory footer (DESIGN §5.9): Ürün · Kulüpler için · Destek · Yasal + dil seçici. */
export async function Footer() {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const columns = [
    {
      title: t("footer.product"),
      links: [
        { href: "/#nasil-calisir", label: t("public.howItWorks") },
        { href: "/#ozellikler", label: t("public.features") },
        { href: "/#sss", label: t("public.faq") },
      ],
    },
    {
      title: t("footer.forClubs"),
      links: [
        { href: "/#kulupler-icin", label: t("footer.clubGuide") },
        { href: "/#roller", label: t("footer.adminGuide") },
        { href: "/kayit", label: t("footer.addUniversity") },
      ],
    },
    {
      title: t("footer.support"),
      links: [
        { href: "/#sss", label: t("footer.help") },
        { href: "/yasal/iletisim", label: t("footer.contact") },
      ],
    },
    {
      title: t("footer.legal"),
      links: [
        { href: "/yasal/kvkk", label: t("footer.kvkk") },
        { href: "/yasal/gizlilik", label: t("footer.privacy") },
        { href: "/yasal/kullanim-sartlari", label: t("footer.terms") },
      ],
    },
  ];

  return (
    <footer className="border-t border-line bg-canvas-subtle">
      <div className="mx-auto grid w-full max-w-(--content-width-xl) gap-(--space-8) px-(--gutter) py-(--space-12) lg:grid-cols-[1.5fr_repeat(4,1fr)]">
        <div className="flex flex-col gap-(--space-3)">
          <span className="inline-flex items-center gap-(--space-2) font-display text-(length:--type-heading-sm) font-semibold text-fg">
            <LogoMark className="size-(--control-height-sm)" />
            groupUp
          </span>
          <p className="max-w-(--popover-width-md) text-(length:--type-body-sm) text-fg-secondary">{t("footer.tagline")}</p>
        </div>
        <div className="grid grid-cols-2 gap-(--space-8) sm:grid-cols-4 lg:contents">
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title} className="flex flex-col gap-(--space-2)">
              <h2 className="text-(length:--type-body-sm) font-semibold text-fg">{col.title}</h2>
              <ul className="flex flex-col">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="inline-flex min-h-(--touch-target-min) items-center text-(length:--type-body-sm) text-fg-secondary hover:text-fg hover:underline lg:min-h-(--control-height-sm)">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-(--content-width-xl) flex-wrap items-center justify-between gap-(--space-4) px-(--gutter) py-(--space-4)">
          <p className="text-(length:--type-caption) text-fg-secondary">{t("footer.copyright")}</p>
          <LocaleSwitcher current={locale} label={t("common.language")} names={{ tr: t("common.languages.tr"), en: t("common.languages.en") }} />
        </div>
      </div>
    </footer>
  );
}
