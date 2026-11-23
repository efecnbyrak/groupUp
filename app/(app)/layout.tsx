import { Suspense } from "react";

import { clubNav } from "@/app/_lib/club-nav";
import { displayUser } from "@/app/_lib/page-user";
import { AppHeader, AppHeaderFallback, BottomTabBar, PublicHeader, type HeaderClub, type PanelLink } from "@/components/shell";
import { ToastProvider } from "@/components/ui";
import { getT } from "@/i18n/server";
import { getSessionUser } from "@/lib/authz";
import { logoutAction } from "@/modules/identity";
import { isUniversityAdmin } from "@/modules/university";

/**
 * Giriş yapmış öğrenci uygulaması: Productive yapı + rahat yoğunluk, panel rengi kullanıcı
 * tipine göre (öğrenci mavi, mezun amber). Yetki kapısı sayfalardadır (requirePageUser).
 * Oturumsuz açılabilen sayfalar (/kulupler/[slug], /katil/[kod]) public header ile görünür.
 */
async function AppFrame({ children }: { children: React.ReactNode }) {
  const [t, user] = await Promise.all([getT(), getSessionUser()]);
  const active = user && user.emailVerified && user.status === "ACTIVE" ? user : null;
  const panels: PanelLink[] = [];
  if (active?.platformRole === "SUPER_ADMIN") panels.push({ href: "/panel/platform", label: t("nav.platformPanel") });
  if (active && (await isUniversityAdmin(active.id))) panels.push({ href: "/panel/admin", label: t("nav.adminPanel") });
  let clubs: HeaderClub[] = [];
  if (active) {
    const nav = await clubNav(active, t);
    clubs = nav.clubs;
    panels.push(...nav.panels);
  }

  return (
    <div data-panel={active?.type === "ALUMNI" ? "alumni" : "student"} data-archetype="productive" data-density="comfortable" className="flex flex-1 flex-col bg-canvas-subtle">
      {active ? <AppHeader user={displayUser(active, t)} panels={panels} clubs={clubs} logoutAction={logoutAction} /> : <PublicHeader />}
      <ToastProvider closeLabel={t("common.close")}>
        <main id="icerik" className="mx-auto flex w-full max-w-(--content-width-lg) flex-1 flex-col gap-(--space-6) px-(--gutter) pt-(--space-8) pb-[calc(var(--bottom-bar-height)+var(--space-8))] lg:pb-(--space-12)">
          {children}
        </main>
      </ToastProvider>
      {active ? <BottomTabBar /> : null}
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<AppHeaderFallback />}>
      <AppFrame>{children}</AppFrame>
    </Suspense>
  );
}
