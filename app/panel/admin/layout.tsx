import { ClipboardCheck, FileClock, GraduationCap, Landmark, LayoutGrid, LifeBuoy, Users, Vote, Building } from "lucide-react";
import { Suspense } from "react";

import { PanelShell, type PanelNavItem } from "@/components/shell";
import { getT } from "@/i18n/server";

import { requireAdminPage } from "./admin-context";

const icon = "size-(--icon-size-md)";

/** Üniversite Admini paneli (DESIGN §8, data-panel="admin"). */
async function AdminFrame({ children }: { children: React.ReactNode }) {
  const [t, { university }] = await Promise.all([getT(), requireAdminPage()]);
  const items: PanelNavItem[] = [
    { href: "/panel/admin", label: t("panel.overview"), icon: <LayoutGrid aria-hidden="true" className={icon} />, exact: true },
    { href: "/panel/admin/onay-kuyrugu", label: t("admin.nav.approvals"), icon: <ClipboardCheck aria-hidden="true" className={icon} /> },
    { href: "/panel/admin/kulupler", label: t("admin.nav.clubs"), icon: <Building aria-hidden="true" className={icon} /> },
    { href: "/panel/admin/kullanicilar", label: t("admin.nav.users"), icon: <Users aria-hidden="true" className={icon} /> },
    { href: "/panel/admin/mezun-dogrulama", label: t("admin.nav.alumni"), icon: <GraduationCap aria-hidden="true" className={icon} /> },
    { href: "/panel/admin/secimler", label: t("admin.nav.elections"), icon: <Vote aria-hidden="true" className={icon} /> },
    { href: "/panel/admin/destek", label: t("panel.support"), icon: <LifeBuoy aria-hidden="true" className={icon} /> },
    { href: "/panel/admin/fakulteler", label: t("admin.nav.faculties"), icon: <Landmark aria-hidden="true" className={icon} /> },
    { href: "/panel/admin/denetim", label: t("admin.nav.audit"), icon: <FileClock aria-hidden="true" className={icon} /> },
  ];
  return (
    <PanelShell panel="admin" title={university.name} roleLabel={t("nav.roles.admin")} items={items}>
      {children}
    </PanelShell>
  );
}

export default function AdminLayout({ children }: LayoutProps<"/panel/admin">) {
  return (
    <Suspense fallback={null}>
      <AdminFrame>{children}</AdminFrame>
    </Suspense>
  );
}
