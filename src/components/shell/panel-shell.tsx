import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ToastProvider } from "@/components/ui";
import { getT } from "@/i18n/server";

import { Logo } from "./logo";
import { NavLink } from "./nav-link";
import { PanelMobileNav } from "./panel-mobile-nav";

export type PanelName = "student" | "alumni" | "president" | "staff" | "admin" | "platform";
/** `badge`: sayaç (onay kuyruğu, açık ticket) — 0 ise gösterilmez; `badgeLabel` ekran okuyucu metni. */
export type PanelNavItem = { href: string; label: string; icon: ReactNode; exact?: boolean; badge?: number; badgeLabel?: string };

/**
 * Panel kabuğu (DESIGN §8, templates/dashboard): üstte 4px rol şeridi, solda sidebar
 * (mobilde çekmece), sidebar başında "Panel · Rol" etiketi. Renk `data-panel` ile gelir.
 * Yetkisi olmayan öğeler çağıran tarafından listeye hiç eklenmez.
 */
export async function PanelShell({ panel, title, roleLabel, items, children }: { panel: PanelName; title: string; roleLabel: string; items: PanelNavItem[]; children: ReactNode }) {
  const t = await getT();
  const nav = (
    <nav aria-label={t("nav.panelMenu")} className="flex flex-col gap-(--space-0-5)">
      {items.map((item) => (
        <NavLink
          key={item.href}
          href={item.href}
          icon={item.icon}
          variant="sidebar"
          exact={item.exact}
          trailing={
            item.badge ? (
              <span className="ml-auto inline-flex min-w-(--space-6) items-center justify-center rounded-badge bg-brand px-(--space-1-5) text-(length:--type-caption) font-semibold text-on-brand">
                <span aria-hidden="true">{item.badge > 99 ? "99+" : item.badge}</span>
                <span className="sr-only">{item.badgeLabel ?? item.badge}</span>
              </span>
            ) : null
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
  const heading = (
    <div className="flex flex-col gap-(--space-0-5) px-(--space-3)">
      <p className="text-(length:--type-body-sm) font-semibold text-fg">{title}</p>
      <p className="text-(length:--type-caption) font-semibold text-brand">{roleLabel}</p>
    </div>
  );

  return (
    <div data-panel={panel} data-archetype="productive" className="flex min-h-dvh flex-col bg-canvas-subtle">
      <div aria-hidden="true" className="h-(--panel-stripe-height) bg-brand" />
      <header className="sticky top-0 z-(--z-header) flex h-(--header-height) items-center gap-(--space-2) border-b border-line bg-card px-(--gutter) lg:hidden">
        <PanelMobileNav labels={{ open: t("nav.panelMenu"), title: `${title} · ${roleLabel}`, close: t("common.close") }}>
          <div className="flex flex-col gap-(--space-4)">
            {nav}
            <BackLink label={t("nav.backToApp")} />
          </div>
        </PanelMobileNav>
        <Logo href="/akis" label={t("nav.backToApp")} />
        <span className="ml-auto truncate text-(length:--type-caption) font-semibold text-brand">
          {title} · {roleLabel}
        </span>
      </header>
      <div className="flex flex-1">
        {/* Sütun sayfa boyunca uzar (zemin + kenarlık); içerik ekrana yapışık kalır. */}
        <div className="hidden w-(--sidebar-width) shrink-0 border-r border-line bg-card lg:block">
          <aside className="sticky top-0 flex h-dvh flex-col gap-(--space-6) overflow-y-auto p-(--space-4)">
            <Logo href="/akis" label={t("nav.backToApp")} />
            {heading}
            {nav}
            <div className="mt-auto">
              <BackLink label={t("nav.backToApp")} />
            </div>
          </aside>
        </div>
        <main id="icerik" className="min-w-0 flex-1 px-(--gutter) py-(--space-6)">
          <ToastProvider closeLabel={t("common.close")}>
            <div className="mx-auto flex w-full max-w-(--content-width-2xl) flex-col gap-(--space-6)">{children}</div>
          </ToastProvider>
        </main>
      </div>
    </div>
  );
}

function BackLink({ label }: { label: string }) {
  return (
    <Link href="/akis" className="flex min-h-(--control-height-md) items-center gap-(--space-2) rounded-control px-(--space-3) text-(length:--type-body-sm) text-fg-secondary hover:bg-muted hover:text-fg">
      <ArrowLeft aria-hidden="true" className="size-(--icon-size-sm)" />
      {label}
    </Link>
  );
}

/** Panel sayfa başlığı: başlık + açıklama + birincil eylem. */
export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-(--space-4)">
      <div className="flex flex-col gap-(--space-1)">
        <h1 className="text-(length:--type-heading-lg) font-semibold text-fg">{title}</h1>
        {description ? <p className="text-(length:--type-body-sm) text-fg-secondary">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
