import { ClipboardList } from "lucide-react";
import { Suspense } from "react";

import { diffRows, personName, RequestStatusBadge, requestTypeLabel } from "@/app/_components/requests";
import { confirmLabels } from "@/app/_lib/form-labels";
import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { Card, ConfirmAction, DiffView, EmptyState, Pagination, Skeleton } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { formatDateTime } from "@/lib/dates";
import { cancelRequestAction, listClubRequests } from "@/modules/approval";

import { requireClubPage } from "../club-context";

export const generateMetadata = titled("club.nav.requests");

/** Kulübün onay talepleri: durum, fark, ret gerekçesi; bekleyen talep geri çekilebilir. */
async function Content({ params, searchParams }: PageProps<"/panel/kulup/[slug]/talepler">) {
  const [t, locale, { slug }, sp] = await Promise.all([getT(), getLocale(), params, searchParams]);
  const { club } = await requireClubPage(slug, "PRESIDENT");
  const cursor = typeof sp.sonraki === "string" ? sp.sonraki.slice(0, 40) : undefined;
  const { items, nextCursor } = await listClubRequests(club.id, cursor);
  const base = `/panel/kulup/${club.slug}/talepler`;

  return (
    <>
      <PageHeader title={t("club.nav.requests")} description={t("club.requests.body")} />
      {items.length === 0 ? (
        <EmptyState icon={<ClipboardList aria-hidden="true" className="size-(--icon-size-lg)" />} title={t("club.requests.empty")} />
      ) : (
        <ul className="flex flex-col gap-(--space-4)">
          {items.map((r) => (
            <li key={r.id}>
              <Card className="flex flex-col gap-(--space-3)">
                <div className="flex flex-wrap items-start justify-between gap-(--space-3)">
                  <div className="flex min-w-0 flex-col gap-(--space-1)">
                    <h2 className="text-(length:--type-heading-sm) font-semibold text-fg">
                      {requestTypeLabel(t, r.type)}
                      {r.target ? <span className="font-normal text-fg-secondary"> · {personName(r.target)}</span> : null}
                    </h2>
                    <p className="text-(length:--type-caption) text-fg-secondary">
                      {t("club.requests.meta", { name: personName(r.requestedBy), date: formatDateTime(r.createdAt, locale) })}
                    </p>
                  </div>
                  <RequestStatusBadge status={r.status} t={t} />
                </div>
                <DiffView rows={diffRows(t, locale, r.diff)} labels={{ before: t("approval.diff.before"), after: t("approval.diff.after") }} empty={t("approval.diff.noRows")} />
                {r.reason ? <p className="text-(length:--type-body-sm) text-fg-secondary">{t("club.requests.reason", { reason: r.reason })}</p> : null}
                {r.status === "REJECTED" && r.decisionNote ? (
                  <p className="rounded-control bg-(--color-danger-subtle) p-(--space-3) text-(length:--type-body-sm) text-fg">{t("club.requests.rejectReason", { reason: r.decisionNote })}</p>
                ) : null}
                {r.status === "PENDING" ? (
                  <div>
                    <ConfirmAction
                      action={cancelRequestAction}
                      values={{ requestId: r.id }}
                      triggerLabel={t("club.requests.cancel")}
                      title={t("club.requests.cancelTitle")}
                      description={t("club.requests.cancelBody")}
                      {...confirmLabels(t)}
                    />
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        firstHref={cursor ? base : undefined}
        nextHref={nextCursor ? `${base}?sonraki=${nextCursor}` : undefined}
        labels={{ label: t("common.pagination"), first: t("common.firstPage"), next: t("common.nextPage") }}
      />
    </>
  );
}

export default function ClubRequestsPage(props: PageProps<"/panel/kulup/[slug]/talepler">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
