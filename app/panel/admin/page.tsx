import { Building, ClipboardCheck, GraduationCap, Landmark, LifeBuoy, UserRound, Users } from "lucide-react";
import { Suspense } from "react";

import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { Skeleton, StatCard } from "@/components/ui";
import { getT } from "@/i18n/server";
import { pendingCount } from "@/modules/approval";
import { listClubsForAdmin } from "@/modules/club";
import { openTicketCount } from "@/modules/ticket";
import { adminStats } from "@/modules/university";

import { requireAdminPage } from "./admin-context";

export const generateMetadata = titled("admin.title");

const icon = "size-(--icon-size-md)";

async function Content() {
  const [t, { university }] = await Promise.all([getT(), requireAdminPage()]);
  const [stats, approvals, tickets, clubs] = await Promise.all([
    adminStats(university.id),
    pendingCount(university.id),
    openTicketCount({ universityId: university.id, scope: "CLUB_TO_ADMIN" }),
    listClubsForAdmin(university.id),
  ]);
  return (
    <>
      <PageHeader title={t("panel.overview")} description={t("admin.overviewBody", { university: university.name })} />
      <div className="grid grid-cols-1 gap-(--space-4) sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("admin.stats.students")} value={stats.students} href="/panel/admin/kullanicilar?tip=STUDENT" icon={<Users aria-hidden="true" className={icon} />} />
        <StatCard label={t("admin.stats.alumni")} value={stats.alumni} href="/panel/admin/kullanicilar?tip=ALUMNI" icon={<UserRound aria-hidden="true" className={icon} />} />
        <StatCard label={t("admin.stats.pendingAlumni")} value={stats.pendingAlumni} href="/panel/admin/mezun-dogrulama" icon={<GraduationCap aria-hidden="true" className={icon} />} />
        <StatCard label={t("admin.stats.faculties")} value={stats.faculties} href="/panel/admin/fakulteler" icon={<Landmark aria-hidden="true" className={icon} />} />
        <StatCard label={t("admin.stats.pendingApprovals")} value={approvals} href="/panel/admin/onay-kuyrugu" icon={<ClipboardCheck aria-hidden="true" className={icon} />} />
        <StatCard label={t("admin.stats.clubs")} value={clubs.nextCursor ? `${clubs.items.length}+` : clubs.items.length} href="/panel/admin/kulupler" icon={<Building aria-hidden="true" className={icon} />} />
        <StatCard label={t("admin.stats.openTickets")} value={tickets} href="/panel/admin/destek" icon={<LifeBuoy aria-hidden="true" className={icon} />} />
      </div>
    </>
  );
}

export default function AdminOverviewPage() {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content />
    </Suspense>
  );
}
