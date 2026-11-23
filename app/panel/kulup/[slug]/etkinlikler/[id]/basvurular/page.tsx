import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { buttonClasses, Card, EmptyState, Skeleton } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { formatDateTime } from "@/lib/dates";
import { getEventForEditor } from "@/modules/event";
import {
  decideManyRegistrationsAction,
  decideManyTeamsAction,
  decideRegistrationAction,
  decideTeamAction,
  listRegistrationsForManage,
  listTeamsForManage,
  RegistrationManageTable,
  type ManageRow,
} from "@/modules/registration";

import { requireClubPage } from "../../../club-context";

export const generateMetadata = titled("registration.manage.title");

const STATUS_KEYS = ["APPLIED", "ACCEPTED", "WAITLISTED", "REJECTED", "CANCELLED"] as const;

/** Kulüp paneli: etkinliğin başvurularını yönet (REGISTRATION_VIEW okur, REGISTRATION_MANAGE karar verir). */
async function Content({ params }: PageProps<"/panel/kulup/[slug]/etkinlikler/[id]/basvurular">) {
  await connection();
  const [t, locale, { slug, id }] = await Promise.all([getT(), getLocale(), params]);
  const { club } = await requireClubPage(slug, "REGISTRATION_VIEW");
  const event = await getEventForEditor(club.id, id);
  if (!event) notFound();
  const base = `/panel/kulup/${club.slug}/etkinlikler/${id}`;
  const exportBase = `/api/v1/registrations/export?clubId=${club.id}&eventId=${id}`;

  const statusLabels = Object.fromEntries(STATUS_KEYS.map((k) => [k, t(`registration.apply.status.${k}`)]));
  const labels = {
    name: t("registration.manage.table.name"),
    status: t("registration.manage.table.status"),
    team: t("registration.manage.table.team"),
    appliedAt: t("registration.manage.table.appliedAt"),
    actions: t("registration.manage.table.actions"),
    accept: t("registration.manage.accept"),
    reject: t("registration.manage.reject"),
    bulkAccept: t("registration.manage.bulkAccept"),
    bulkReject: t("registration.manage.bulkReject"),
    all: t("registration.manage.all"),
    selected: t("registration.manage.selected"),
    statusLabels,
  };

  let rows: ManageRow[] = [];
  let idField: "registrationId" | "teamId" = "registrationId";

  if (event.content.mode === "INDIVIDUAL") {
    const data = await listRegistrationsForManage(club.id, id);
    rows = (data?.items ?? []).map((r) => ({
      id: r.id,
      name: [r.user.profile?.firstName, r.user.profile?.lastName].filter(Boolean).join(" ") || r.user.email,
      email: r.user.email,
      team: r.team?.name ?? null,
      status: r.status,
      appliedAt: formatDateTime(r.createdAt, locale),
    }));
  } else {
    idField = "teamId";
    const data = await listTeamsForManage(club.id, id);
    rows = (data?.items ?? []).map((team) => ({
      id: team.id,
      name: team.name,
      email: `${team.members.length} üye`,
      team: null,
      status: team.status,
      appliedAt: formatDateTime(team.createdAt, locale),
    }));
  }

  return (
    <>
      <Link href={base} className="inline-flex items-center gap-(--space-1) text-(length:--type-body-sm) font-semibold text-link hover:underline">
        <ArrowLeft aria-hidden="true" className="size-(--icon-size-sm)" />
        {event.content.titleTr || t("event.editor.title")}
      </Link>
      <PageHeader
        title={t("registration.manage.title")}
        description={t("registration.manage.body")}
        action={
          <div className="flex flex-wrap gap-(--space-2)">
            {/* Düz <a>: next/link RSC prefetch'i bir API indirme adresine uygulanmasın */}
            <a href={`${exportBase}&format=xlsx`} className={buttonClasses({ variant: "secondary" })}>
              <Download aria-hidden="true" className="size-(--icon-size-sm)" />
              {t("registration.manage.exportXlsx")}
            </a>
            <a href={`${exportBase}&format=csv`} className={buttonClasses({ variant: "secondary" })}>
              <Download aria-hidden="true" className="size-(--icon-size-sm)" />
              {t("registration.manage.exportCsv")}
            </a>
          </div>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title={t("registration.manage.empty")} />
      ) : (
        <Card padding="none">
          <RegistrationManageTable
            clubId={club.id}
            eventId={id}
            rows={rows}
            labels={labels}
            idField={idField}
            decideAction={event.content.mode === "INDIVIDUAL" ? decideRegistrationAction : decideTeamAction}
            decideManyAction={event.content.mode === "INDIVIDUAL" ? decideManyRegistrationsAction : decideManyTeamsAction}
          />
        </Card>
      )}
    </>
  );
}

export default function ManagePage(props: PageProps<"/panel/kulup/[slug]/etkinlikler/[id]/basvurular">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
