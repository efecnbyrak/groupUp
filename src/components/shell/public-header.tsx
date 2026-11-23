import { ButtonLink, LocaleSwitcher } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";

import { Logo } from "./logo";
import { PublicMobileMenu } from "./public-mobile-menu";

/** Giriş yapmamış header (Editorial, 56px, sticky) — DESIGN §4 son madde. */
export async function PublicHeader() {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const links = [
    { href: "/#nasil-calisir", label: t("public.howItWorks") },
    { href: "/#ozellikler", label: t("public.features") },
    { href: "/#kulupler-icin", label: t("public.forClubs") },
    { href: "/#sss", label: t("public.faq") },
  ];
  const switcher = (
    <LocaleSwitcher current={locale} label={t("common.language")} names={{ tr: t("common.languages.tr"), en: t("common.languages.en") }} />
  );

  return (
    <header className="sticky top-0 z-(--z-header) border-b border-line bg-canvas/95 backdrop-blur supports-[backdrop-filter]:bg-canvas/80">
      <div className="mx-auto flex h-(--header-height) w-full max-w-(--content-width-xl) items-center gap-(--space-4) px-(--gutter)">
        <Logo href="/" label={t("public.homeLink")} />
        <nav aria-label={t("nav.main")} className="hidden flex-1 items-center justify-center gap-(--space-1) lg:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="inline-flex min-h-(--touch-target-min) items-center rounded-control px-(--space-3) text-(length:--type-body-sm) font-semibold text-fg-secondary hover:text-fg focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-(--color-focus)"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-(--space-2) lg:ml-0">
          <div className="hidden lg:block">{switcher}</div>
          <ButtonLink href="/giris" variant="ghost" size="sm">
            {t("public.login")}
          </ButtonLink>
          <ButtonLink href="/kayit" size="sm">
            {t("public.register")}
          </ButtonLink>
          <PublicMobileMenu
            links={links}
            extra={switcher}
            labels={{ open: t("public.openMenu"), title: t("common.menu"), close: t("common.close"), login: t("public.login"), register: t("public.register") }}
          />
        </div>
      </div>
    </header>
  );
}

/** Suspense yedeği: aynı yükseklik → yerleşim kayması yok. */
export function PublicHeaderFallback() {
  return <div aria-hidden="true" className="h-(--header-height) border-b border-line" />;
}
