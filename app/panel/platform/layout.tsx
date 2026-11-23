import { Building2, FolderTree, Globe, Inbox, LayoutGrid, LifeBuoy, ShieldCheck, Activity } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { requirePageUser } from "@/app/_lib/page-user";
import { PanelShell, type PanelNavItem } from "@/components/shell";
import { getT } from "@/i18n/server";

const icon = "size-(--icon-size-md)";

/** Platform paneli kabuğu (Süper Admin). İçerik F4'te; menü DESIGN §8. */
async function PlatformFrame({ children }: { children: React.ReactNode }) {
  const [t, user] = await Promise.all([getT(), requirePageUser("/panel/platform")]);
  if (user.platformRole !== "SUPER_ADMIN") notFound();
  const items: PanelNavItem[] = [
    { href: "/panel/platform", label: t("panel.overview"), icon: <LayoutGrid aria-hidden="true" className={icon} />, exact: true },
    { href: "/panel/platform/universiteler", label: t("panel.universities"), icon: <Building2 aria-hidden="true" className={icon} /> },
    { href: "/panel/platform/domainler", label: t("panel.domains"), icon: <Globe aria-hidden="true" className={icon} /> },
    { href: "/panel/platform/adminler", label: t("panel.admins"), icon: <ShieldCheck aria-hidden="true" className={icon} /> },
    { href: "/panel/platform/talepler", label: t("panel.universityRequests"), icon: <Inbox aria-hidden="true" className={icon} /> },
    { href: "/panel/platform/kategoriler", label: t("panel.categories"), icon: <FolderTree aria-hidden="true" className={icon} /> },
    { href: "/panel/platform/destek", label: t("panel.support"), icon: <LifeBuoy aria-hidden="true" className={icon} /> },
    { href: "/panel/platform/sistem", label: t("panel.systemStatus"), icon: <Activity aria-hidden="true" className={icon} /> },
  ];
  return (
    <PanelShell panel="platform" title={t("panel.platformTitle")} roleLabel={t("nav.roles.platform")} items={items}>
      {children}
    </PanelShell>
  );
}

export default function PlatformLayout({ children }: LayoutProps<"/panel/platform">) {
  return (
    <Suspense fallback={null}>
      <PlatformFrame>{children}</PlatformFrame>
    </Suspense>
  );
}
