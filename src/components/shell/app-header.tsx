import { Bell, CalendarCheck, ChevronDown, Compass, House, LayoutDashboard, LogOut, Search, Shield, User, UserRound, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Avatar, Badge, Dropdown, DropdownButton, DropdownLabel, DropdownLink, DropdownSeparator, EmptyState, LocaleSwitcher } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";

import { Logo } from "./logo";
import { NavLink } from "./nav-link";

export type AppHeaderUser = { name: string; email: string; roleLabel: string; avatarUrl?: string | null };
export type PanelLink = { href: string; label: string };
/** Header "Kulüpler ▾" — Kulüplerim (DESIGN §4). */
export type HeaderClub = { href: string; name: string; logoUrl: string | null; roleLabel: string; presidentLabel: string };
/** Bildirim zili — modül verisi app katmanından prop olarak gelir (shell modül import edemez). */
export type HeaderNotification = { id: string; title: string; body: string | null; href: string | null; read: boolean; when: string };
export type NotificationFormAction = (formData: FormData) => Promise<void>;

const icon = "size-(--icon-size-md)";

/**
 * Giriş yapmış header (Productive, 64px, sticky) — DESIGN §4.
 * Kulüpler menüsü app katmanından `clubs` ile dolar; bildirimler F10'da.
 * `logoutAction` app katmanından gelir (shell modül import edemez).
 */
export async function AppHeader({
  user,
  panels,
  clubs = [],
  notifications = [],
  unreadCount = 0,
  markNotificationReadFormAction,
  markAllNotificationsReadFormAction,
  logoutAction,
}: {
  user: AppHeaderUser;
  panels: PanelLink[];
  clubs?: HeaderClub[];
  notifications?: HeaderNotification[];
  unreadCount?: number;
  markNotificationReadFormAction?: NotificationFormAction;
  markAllNotificationsReadFormAction?: NotificationFormAction;
  logoutAction: () => Promise<void>;
}) {
  const [t, locale] = await Promise.all([getT(), getLocale()]);

  const clubsEmpty = (
    <div className="flex flex-col gap-(--space-2) p-(--space-2)">
      <DropdownLabel>{t("nav.myClubs")}</DropdownLabel>
      {clubs.length === 0 ? (
        <>
          <p className="px-(--space-3) text-(length:--type-body-sm) text-fg">{t("nav.noClubs")}</p>
          <p className="px-(--space-3) text-(length:--type-caption) text-fg-secondary">{t("nav.noClubsHint")}</p>
        </>
      ) : (
        clubs.map((c) => (
          <DropdownLink key={c.href} href={c.href}>
            <Avatar name={c.name} src={c.logoUrl} size="sm" shape="square" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-semibold text-fg">{c.name}</span>
              <span className="truncate text-(length:--type-caption) text-fg-secondary">
                {c.roleLabel} · {c.presidentLabel}
              </span>
            </span>
          </DropdownLink>
        ))
      )}
      <DropdownSeparator />
      <DropdownLink href="/kulupler">
        <Compass aria-hidden="true" className={icon} />
        {t("nav.allClubs")}
      </DropdownLink>
    </div>
  );

  return (
    <header className="sticky top-0 z-(--z-header) border-b border-line bg-card">
      <div className="mx-auto flex h-(--header-height) w-full max-w-(--content-width-xl) items-center gap-(--space-2) px-(--gutter)">
        <Logo href="/akis" label={t("nav.home")} />
        <nav aria-label={t("nav.main")} className="ml-(--space-6) hidden h-full items-stretch lg:flex">
          <NavLink href="/akis" variant="header">
            {t("nav.home")}
          </NavLink>
          <NavLink href="/kesfet" variant="header">
            {t("nav.explore")}
          </NavLink>
          <div className="flex items-center px-(--space-1)">
            <Dropdown
              label={t("nav.clubsMenu")}
              align="start"
              width="lg"
              triggerClassName="min-h-(--touch-target-min) px-(--space-2) text-(length:--type-body-sm) font-semibold text-fg-secondary hover:text-fg"
              trigger={
                <>
                  {t("nav.clubs")}
                  <ChevronDown aria-hidden="true" className="size-(--icon-size-sm)" />
                </>
              }
            >
              {clubsEmpty}
            </Dropdown>
          </div>
          <NavLink href="/etkinliklerim" variant="header">
            {t("nav.myEvents")}
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-(--space-1)">
          <IconButtonLink href="/kesfet" label={t("nav.search")} icon={<Search aria-hidden="true" className={icon} />} />
          <Dropdown
            label={unreadCount > 0 ? t("notifications.unreadBadge", { count: unreadCount }) : t("nav.notifications")}
            width="lg"
            triggerClassName="relative inline-flex size-(--touch-target-min) justify-center text-fg-secondary hover:bg-muted hover:text-fg"
            trigger={
              <>
                <Bell aria-hidden="true" className={icon} />
                {unreadCount > 0 ? <span aria-hidden="true" className="absolute top-(--space-1-5) right-(--space-1-5) size-2 rounded-full bg-(--color-danger-fill)" /> : null}
              </>
            }
          >
            <div className="flex items-center justify-between gap-(--space-2) px-(--space-3) pt-(--space-2)">
              <p className="text-(length:--type-caption) font-semibold text-fg-secondary">{t("notifications.title")}</p>
              {unreadCount > 0 && markAllNotificationsReadFormAction ? (
                <form action={markAllNotificationsReadFormAction}>
                  <button type="submit" className="text-(length:--type-caption) font-semibold text-link hover:underline">
                    {t("notifications.markAllRead")}
                  </button>
                </form>
              ) : null}
            </div>
            {notifications.length === 0 ? (
              <EmptyState title={t("notifications.empty")} description={t("notifications.emptyBody")} className="border-none py-(--space-6)" />
            ) : (
              <div className="flex flex-col">
                {notifications.map((n) => (
                  <div key={n.id} className={`flex items-start gap-(--space-2) px-(--space-3) py-(--space-2) ${n.read ? "" : "bg-(--color-primary-subtle)"}`}>
                    <Link href={n.href ?? "/bildirimler"} className="min-w-0 flex-1">
                      <p className="truncate text-(length:--type-body-sm) font-semibold text-fg">{n.title}</p>
                      {n.body ? <p className="truncate text-(length:--type-caption) text-fg-secondary">{n.body}</p> : null}
                      <p className="text-(length:--type-caption) text-fg-tertiary">{n.when}</p>
                    </Link>
                    {!n.read && markNotificationReadFormAction ? (
                      <form action={markNotificationReadFormAction}>
                        <input type="hidden" name="id" value={n.id} />
                        <button type="submit" aria-label={t("notifications.markRead")} className="size-2 shrink-0 rounded-full bg-(--color-primary)" />
                      </form>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
            <DropdownSeparator />
            <DropdownLink href="/bildirimler">{t("notifications.viewAll")}</DropdownLink>
          </Dropdown>
          <div className="hidden lg:block">
            <LocaleSwitcher current={locale} label={t("common.language")} names={{ tr: t("common.languages.tr"), en: t("common.languages.en") }} />
          </div>
          <Dropdown label={t("nav.accountMenu")} triggerClassName="p-(--space-0-5)" trigger={<Avatar name={user.name} src={user.avatarUrl} size="sm" />}>
            <div className="flex flex-col gap-(--space-1) px-(--space-3) py-(--space-2)">
              <p className="truncate font-semibold text-fg">{user.name}</p>
              <p className="truncate text-(length:--type-caption) text-fg-secondary">{user.email}</p>
              <Badge tone="brand" className="self-start">
                {user.roleLabel}
              </Badge>
            </div>
            <DropdownSeparator />
            <DropdownLink href="/profil">
              <UserRound aria-hidden="true" className={icon} />
              {t("nav.profile")}
            </DropdownLink>
            <DropdownLink href="/hesap">
              <User aria-hidden="true" className={icon} />
              {t("nav.account")}
            </DropdownLink>
            <DropdownLink href="/hesap/guvenlik">
              <Shield aria-hidden="true" className={icon} />
              {t("nav.security")}
            </DropdownLink>
            {panels.length > 0 ? (
              <>
                <DropdownSeparator />
                <DropdownLabel>{t("nav.panels")}</DropdownLabel>
                {panels.map((p) => (
                  <DropdownLink key={p.href} href={p.href}>
                    <LayoutDashboard aria-hidden="true" className={icon} />
                    {p.label}
                  </DropdownLink>
                ))}
              </>
            ) : null}
            <DropdownSeparator />
            <div className="px-(--space-3) py-(--space-2) lg:hidden">
              <LocaleSwitcher current={locale} label={t("common.language")} names={{ tr: t("common.languages.tr"), en: t("common.languages.en") }} />
            </div>
            <form action={logoutAction}>
              <DropdownButton type="submit">
                <LogOut aria-hidden="true" className={icon} />
                {t("nav.logout")}
              </DropdownButton>
            </form>
          </Dropdown>
        </div>
      </div>
    </header>
  );
}

function IconButtonLink({ href, label, icon: glyph }: { href: string; label: string; icon: ReactNode }) {
  return (
    <Link href={href} aria-label={label} title={label} className="inline-flex size-(--touch-target-min) items-center justify-center rounded-control text-fg-secondary hover:bg-muted hover:text-fg focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-(--color-focus)">
      {glyph}
    </Link>
  );
}

/** Mobil alt sekme çubuğu (<1024) — etiketler her zaman görünür (DESIGN §4). */
export async function BottomTabBar() {
  const t = await getT();
  const tabs = [
    { href: "/akis", label: t("nav.home"), icon: <House aria-hidden="true" className={icon} /> },
    { href: "/kesfet", label: t("nav.explore"), icon: <Compass aria-hidden="true" className={icon} /> },
    { href: "/kulupler", label: t("nav.clubs"), icon: <Users aria-hidden="true" className={icon} /> },
    { href: "/etkinliklerim", label: t("nav.myEvents"), icon: <CalendarCheck aria-hidden="true" className={icon} /> },
    { href: "/hesap", label: t("nav.profile"), icon: <User aria-hidden="true" className={icon} /> },
  ];
  return (
    <nav
      aria-label={t("nav.mobile")}
      className="fixed inset-x-0 bottom-0 z-(--z-sticky) flex border-t border-line bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {tabs.map((tab) => (
        <NavLink key={tab.href} href={tab.href} icon={tab.icon} variant="tab">
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppHeaderFallback() {
  return <div aria-hidden="true" className="h-(--header-height) border-b border-line bg-card" />;
}

