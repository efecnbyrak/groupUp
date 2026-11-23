import { Inbox } from "lucide-react";
import { Suspense } from "react";

import { confirmLabels } from "@/app/_lib/form-labels";
import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { Badge, ButtonLink, Card, ConfirmAction, EmptyState, Skeleton, Table } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { formatDateTime } from "@/lib/dates";
import { listUniversityRequests, rejectUniversityRequestAction } from "@/modules/university";

export const generateMetadata = titled("panel.universityRequests");

async function Content() {
  const [t, locale, pending, resolved] = await Promise.all([getT(), getLocale(), listUniversityRequests("PENDING"), listUniversityRequests("RESOLVED")]);
  const confirm = confirmLabels(t);
  return (
    <>
      <PageHeader title={t("panel.universityRequests")} description={t("platform.requests.body")} />
      {pending.length === 0 ? (
        <EmptyState icon={<Inbox aria-hidden="true" className="size-(--icon-size-lg)" />} title={t("platform.requests.empty")} />
      ) : (
        <ul className="grid grid-cols-1 gap-(--space-4) lg:grid-cols-2">
          {pending.map((r) => (
            <li key={r.id}>
              <Card className="flex h-full flex-col gap-(--space-3)">
                <div className="flex flex-col gap-(--space-1)">
                  <p className="text-(length:--type-heading-sm) font-semibold text-fg">{r.name}</p>
                  <p className="text-(length:--type-body-sm) text-fg-secondary">
                    {r.domain} · {r.email} · {formatDateTime(r.createdAt, locale)}
                  </p>
                </div>
                {r.note ? <p className="text-(length:--type-body-sm) text-fg">{r.note}</p> : null}
                <div className="mt-auto flex flex-wrap gap-(--space-3) pt-(--space-2)">
                  <ButtonLink href={`/panel/platform/universiteler/yeni?talep=${r.id}`} size="sm">
                    {t("platform.requests.createUniversity")}
                  </ButtonLink>
                  <ConfirmAction
                    action={rejectUniversityRequestAction}
                    values={{ id: r.id }}
                    triggerLabel={t("platform.requests.reject")}
                    title={t("platform.requests.rejectTitle", { name: r.name })}
                    description={t("platform.requests.rejectBody")}
                    {...confirm}
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {resolved.length > 0 ? (
        <section className="flex flex-col gap-(--space-3)">
          <h2 className="text-(length:--type-heading-sm) font-semibold text-fg">{t("platform.requests.resolved")}</h2>
          <Table
            caption={t("platform.requests.resolved")}
            columns={[
              { key: "name", header: t("platform.fields.name"), sortable: true },
              { key: "domain", header: t("platform.fields.domain"), hideBelow: "sm" },
              { key: "date", header: t("platform.fields.date"), hideBelow: "md" },
              { key: "status", header: t("platform.fields.status") },
            ]}
            rows={resolved.map((r) => ({
              id: r.id,
              sort: { name: r.name },
              cells: {
                name: r.name,
                domain: r.domain,
                date: formatDateTime(r.createdAt, locale),
                status: <Badge tone={r.status === "APPROVED" ? "success" : "neutral"}>{t(`platform.requestStatus.${r.status}`)}</Badge>,
              },
            }))}
          />
        </section>
      ) : null}
    </>
  );
}

export default function RequestsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content />
    </Suspense>
  );
}
