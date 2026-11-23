import { ClipboardList, Info, LayoutGrid, LifeBuoy, Ticket, UserCog, Users } from "lucide-react";
import { Suspense } from "react";

import { PanelShell, type PanelNavItem } from "@/components/shell";
import { getT } from "@/i18n/server";

import { requireClubPage } from "./club-context";

const icon = "size-(--icon-size-md)";

/** Kulüp paneli (DESIGN §8): Başkan `president` (zümrüt), görevli `staff` (teal). Yetkisiz menü öğesi eklenmez. */
async function ClubFrame({ slug, children }: { slug: string; children: React.ReactNode }) {
  const [t, { club, access, can }] = await Promise.all([getT(), requireClubPage(slug)]);
  const base = `/panel/kulup/${club.slug}`;
  const items: PanelNavItem[] = [
    { href: base, label: t("panel.overview"), icon: <LayoutGrid aria-hidden="true" className={icon} />, exact: true },
    { href: `${base}/uyeler`, label: t("club.nav.members"), icon: <Users aria-hidden="true" className={icon} /> },
    { href: `${base}/ekip`, label: t("club.nav.staff"), icon: <UserCog aria-hidden="true" className={icon} /> },
  ];
  if (can("MEMBER_INVITE")) items.push({ href: `${base}/davetler`, label: t("club.nav.invites"), icon: <Ticket aria-hidden="true" className={icon} /> });
  if (can("PRESIDENT")) {
    items.push({ href: `${base}/talepler`, label: t("club.nav.requests"), icon: <ClipboardList aria-hidden="true" className={icon} /> });
    items.push({ href: `${base}/bilgiler`, label: t("club.nav.info"), icon: <Info aria-hidden="true" className={icon} /> });
  }
  if (can("TICKET_OPEN")) items.push({ href: `${base}/destek`, label: t("panel.support"), icon: <LifeBuoy aria-hidden="true" className={icon} /> });
  const president = access.role === "PRESIDENT";
  return (
    <PanelShell panel={president ? "president" : "staff"} title={club.name} roleLabel={president ? t("nav.roles.president") : t("nav.roles.staff")} items={items}>
      {children}
    </PanelShell>
  );
}

async function Frame({ params, children }: LayoutProps<"/panel/kulup/[slug]">) {
  const { slug } = await params;
  return <ClubFrame slug={slug}>{children}</ClubFrame>;
}

export default function ClubPanelLayout(props: LayoutProps<"/panel/kulup/[slug]">) {
  return (
    <Suspense fallback={null}>
      <Frame {...props} />
    </Suspense>
  );
}
