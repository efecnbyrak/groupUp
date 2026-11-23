import { ClipboardCheck, Paperclip, Search } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { personName, requestTypeLabel } from "@/app/_components/requests";
import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { Button, Card, EmptyState, Pagination, Select, Skeleton, Table } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { formatDateTime } from "@/lib/dates";
import { listQueue, queueFilterTypes } from "@/modules/approval";

import { requireAdminPage } from "../admin-context";

export const generateMetadata = titled("admin.nav.approvals");

type QueueType = (typeof queueFilterTypes)[number];
const pickType = (v: unknown): QueueType | undefined => (typeof v === "string" && (queueFilterTypes as readonly string[]).includes(v) ? (v as QueueType) : undefined);

/** Onay kuyruğu (APPROVALS-TICKETS §6): en eski önce, tip filtresi, toplu işlem yok. */
async function Content({ searchParams }: PageProps<"/panel/admin/onay-kuyrugu">) {
  const [t, locale, sp, { university }] = await Promise.all([getT(), getLocale(), searchParams, requireAdminPage()]);
  const type = pickType(sp.tip);
  const cursor = typeof sp.sonraki === "string" ? sp.sonraki.slice(0, 40) : undefined;
  const { items, nextCursor } = await listQueue(university.id, { type, cursor });
  const href = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ tip: type, ...extra })) if (v) p.set(k, v);
    const s = p.toString();
    return `/panel/admin/onay-kuyrugu${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader title={t("admin.nav.approvals")} description={t("approval.queue.body")} />
      <Card padding="sm">
        <form method="get" role="search" className="flex flex-col gap-(--space-3) sm:flex-row sm:items-end">
          <div className="sm:flex-1">
            <Select id="tip" label={t("approval.queue.type")} defaultValue={type ?? ""} placeholder={t("admin.users.all")} options={queueFilterTypes.map((v) => ({ value: v, label: requestTypeLabel(t, v) }))} />
          </div>
          <Button type="submit" variant="secondary" icon={<Search aria-hidden="true" className="size-(--icon-size-sm)" />}>
            {t("admin.users.filter")}
          </Button>
        </form>
      </Card>
      <Table
        caption={t("admin.nav.approvals")}
        columns={[
          { key: "type", header: t("approval.queue.type") },
          { key: "club", header: t("approval.queue.club"), hideBelow: "md" },
          { key: "by", header: t("approval.queue.requestedBy"), hideBelow: "sm" },
          { key: "date", header: t("approval.queue.date"), hideBelow: "lg" },
        ]}
        rows={items.map((r) => ({
          id: r.id,
          cells: {
            type: (
              <Link href={`/panel/admin/onay-kuyrugu/${r.id}`} className="inline-flex items-center gap-(--space-2) font-semibold text-link hover:underline">
                {requestTypeLabel(t, r.type)}
                {r._count.attachments ? (
                  <span className="inline-flex items-center gap-(--space-0-5) text-(length:--type-caption) text-fg-secondary">
                    <Paperclip aria-hidden="true" className="size-(--icon-size-sm)" />
                    <span className="sr-only">{t("approval.attachments")}</span>
                    {r._count.attachments}
                  </span>
                ) : null}
              </Link>
            ),
            club: r.club?.name ?? "—",
            by: personName(r.requestedBy),
            date: formatDateTime(r.createdAt, locale),
          },
        }))}
        empty={<EmptyState icon={<ClipboardCheck aria-hidden="true" className="size-(--icon-size-lg)" />} title={t("approval.queue.empty")} description={t("approval.queue.emptyBody")} />}
      />
      <Pagination
        firstHref={cursor ? href({}) : undefined}
        nextHref={nextCursor ? href({ sonraki: nextCursor }) : undefined}
        labels={{ label: t("common.pagination"), first: t("common.firstPage"), next: t("common.nextPage") }}
      />
    </>
  );
}

export default function ApprovalQueuePage(props: PageProps<"/panel/admin/onay-kuyrugu">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
