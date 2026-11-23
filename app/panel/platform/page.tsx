import { Building2, Inbox, ShieldCheck, Users } from "lucide-react";
import { Suspense } from "react";

import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { Skeleton, StatCard } from "@/components/ui";
import { getT } from "@/i18n/server";
import { platformStats } from "@/modules/university";

export const generateMetadata = titled("panel.platformTitle");

const icon = "size-(--icon-size-md)";

async function Stats() {
  const [t, stats] = await Promise.all([getT(), platformStats()]);
  return (
    <div className="grid grid-cols-1 gap-(--space-4) sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label={t("platform.stats.universities")} value={stats.universities} href="/panel/platform/universiteler" icon={<Building2 aria-hidden="true" className={icon} />} />
      <StatCard label={t("platform.stats.users")} value={stats.users} icon={<Users aria-hidden="true" className={icon} />} />
      <StatCard label={t("platform.stats.admins")} value={stats.admins} href="/panel/platform/adminler" icon={<ShieldCheck aria-hidden="true" className={icon} />} />
      <StatCard label={t("platform.stats.pendingRequests")} value={stats.pendingRequests} href="/panel/platform/talepler" icon={<Inbox aria-hidden="true" className={icon} />} />
    </div>
  );
}

async function Header() {
  const t = await getT();
  return <PageHeader title={t("panel.overview")} description={t("platform.overviewBody")} />;
}

export default function PlatformOverviewPage() {
  return (
    <>
      <Suspense fallback={<Skeleton className="h-(--space-12) w-1/3" />}>
        <Header />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
        <Stats />
      </Suspense>
    </>
  );
}
