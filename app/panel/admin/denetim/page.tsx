import { FileClock, Search } from "lucide-react";
import { Suspense } from "react";

import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { Button, Card, EmptyState, Pagination, Select, Skeleton, Table } from "@/components/ui";
import type { MessageKey } from "@/i18n/messages";
import { getLocale, getT } from "@/i18n/server";
import { listAuditLogs } from "@/lib/audit";
import { formatDateTime } from "@/lib/dates";

import { requireAdminPage } from "../admin-context";

export const generateMetadata = titled("admin.nav.audit");

const PREFIXES = ["approval.", "club.", "ticket.", "university.", "identity.", "profile."] as const;
const pickPrefix = (v: unknown) => (typeof v === "string" && (PREFIXES as readonly string[]).includes(v) ? v : undefined);

/** Denetim kaydı (AuditLog) — kendi üniversitesi, yalnızca okuma. */
async function Content({ searchParams }: PageProps<"/panel/admin/denetim">) {
  const [t, locale, sp, { university }] = await Promise.all([getT(), getLocale(), searchParams, requireAdminPage()]);
  const prefix = pickPrefix(sp.alan);
  const cursor = typeof sp.sonraki === "string" ? sp.sonraki.slice(0, 40) : undefined;
  const { items, nextCursor } = await listAuditLogs(university.id, { prefix, cursor });
  const href = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ alan: prefix, ...extra })) if (v) p.set(k, v);
    const s = p.toString();
    return `/panel/admin/denetim${s ? `?${s}` : ""}`;
  };
  const actionLabel = (action: string) => {
    const key = `audit.actions.${action.replaceAll(".", "_")}` as MessageKey;
    const label = t(key);
    return label === key ? action : label;
  };

  return (
    <>
      <PageHeader title={t("admin.nav.audit")} description={t("audit.body")} />
      <Card padding="sm">
        <form method="get" role="search" className="flex flex-col gap-(--space-3) sm:flex-row sm:items-end">
          <div className="sm:flex-1">
            <Select id="alan" label={t("audit.area")} defaultValue={prefix ?? ""} placeholder={t("admin.users.all")} options={PREFIXES.map((p) => ({ value: p, label: t(`audit.areas.${p.slice(0, -1)}` as MessageKey) }))} />
          </div>
          <Button type="submit" variant="secondary" icon={<Search aria-hidden="true" className="size-(--icon-size-sm)" />}>
            {t("admin.users.filter")}
          </Button>
        </form>
      </Card>
      <Table
        caption={t("admin.nav.audit")}
        columns={[
          { key: "date", header: t("audit.date") },
          { key: "action", header: t("audit.action") },
          { key: "actor", header: t("audit.actor"), hideBelow: "sm" },
          { key: "target", header: t("audit.target"), hideBelow: "lg" },
        ]}
        rows={items.map((r) => ({
          id: r.id,
          cells: {
            date: <span className="whitespace-nowrap">{formatDateTime(r.createdAt, locale)}</span>,
            action: actionLabel(r.action),
            actor: r.actorName ?? t("audit.system"),
            target: (
              <span className="text-(length:--type-caption) text-fg-secondary">
                {r.targetType} · {r.targetId.slice(-8)}
              </span>
            ),
          },
        }))}
        empty={<EmptyState icon={<FileClock aria-hidden="true" className="size-(--icon-size-lg)" />} title={t("audit.empty")} />}
      />
      <Pagination
        firstHref={cursor ? href({}) : undefined}
        nextHref={nextCursor ? href({ sonraki: nextCursor }) : undefined}
        labels={{ label: t("common.pagination"), first: t("common.firstPage"), next: t("common.nextPage") }}
      />
    </>
  );
}

export default function AuditPage(props: PageProps<"/panel/admin/denetim">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
