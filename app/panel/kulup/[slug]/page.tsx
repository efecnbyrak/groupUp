import { ClipboardList, ExternalLink, Ticket, UserCog, UserPlus, Users } from "lucide-react";
import { Suspense } from "react";

import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { ButtonLink, Skeleton, StatCard } from "@/components/ui";
import { getT } from "@/i18n/server";
import { MAX_STAFF } from "@/lib/club-roles";
import { pendingTargetsForClub } from "@/modules/approval";
import { clubOverview } from "@/modules/club";

import { requireClubPage } from "./club-context";

export const generateMetadata = titled("club.panel.title");
const icon = "size-(--icon-size-md)";

async function Content({ params }: PageProps<"/panel/kulup/[slug]">) {
  const [t, { slug }] = await Promise.all([getT(), params]);
  const { club, can } = await requireClubPage(slug);
  const [stats, pending] = await Promise.all([clubOverview(club.id), pendingTargetsForClub(club.id)]);
  const base = `/panel/kulup/${club.slug}`;
  return (
    <>
      <PageHeader
        title={t("panel.overview")}
        description={t("club.panel.overviewBody", { club: club.name })}
        action={
          <ButtonLink href={`/kulupler/${club.slug}`} variant="secondary" icon={<ExternalLink aria-hidden="true" className="size-(--icon-size-sm)" />}>
            {t("club.admin.viewPage")}
          </ButtonLink>
        }
      />
      <div className="grid grid-cols-1 gap-(--space-4) sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("club.stats.members")} value={stats.members} href={`${base}/uyeler`} icon={<Users aria-hidden="true" className={icon} />} />
        <StatCard label={t("club.stats.joined30")} value={stats.joinedLast30} icon={<UserPlus aria-hidden="true" className={icon} />} />
        <StatCard label={t("club.stats.staff")} value={`${stats.staff} / ${MAX_STAFF}`} href={`${base}/ekip`} icon={<UserCog aria-hidden="true" className={icon} />} />
        {can("PRESIDENT") ? (
          <StatCard label={t("club.stats.pendingRequests")} value={pending.length} href={`${base}/talepler`} icon={<ClipboardList aria-hidden="true" className={icon} />} />
        ) : can("MEMBER_INVITE") ? (
          <StatCard label={t("club.stats.invites")} value={stats.invites} href={`${base}/davetler`} icon={<Ticket aria-hidden="true" className={icon} />} />
        ) : null}
      </div>
    </>
  );
}

export default function ClubOverviewPage(props: PageProps<"/panel/kulup/[slug]">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
