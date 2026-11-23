import { Suspense } from "react";

import { confirmLabels } from "@/app/_lib/form-labels";
import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { ActionForm, Badge, Card, ConfirmAction, EmptyState, Skeleton, Table } from "@/components/ui";
import { getT } from "@/i18n/server";
import { addDomainAction, listAllDomains, listUniversities, removeDomainAction } from "@/modules/university";

export const generateMetadata = titled("panel.domains");

async function Content() {
  const [t, domains, universities] = await Promise.all([getT(), listAllDomains(), listUniversities()]);
  const confirm = confirmLabels(t);
  return (
    <>
      <PageHeader title={t("panel.domains")} description={t("platform.domains.body")} />
      <Card>
        <ActionForm
          action={addDomainAction}
          layout="inline"
          resetOnSuccess
          fields={[
            { type: "select", name: "universityId", label: t("platform.fields.university"), required: true, placeholder: t("common.select"), options: universities.map((u) => ({ value: u.id, label: u.name })) },
            { type: "text", name: "domain", label: t("platform.fields.domain"), placeholder: "ogr.ornek.edu.tr", required: true, maxLength: 253 },
            { type: "select", name: "type", label: t("platform.fields.domainType"), required: true, options: (["STUDENT", "ALUMNI"] as const).map((v) => ({ value: v, label: t(`platform.domainTypes.${v}`) })) },
          ]}
          submitLabel={t("common.add")}
          loadingLabel={confirm.loadingLabel}
        />
      </Card>
      <Table
        caption={t("panel.domains")}
        columns={[
          { key: "domain", header: t("platform.fields.domain"), sortable: true },
          { key: "type", header: t("platform.fields.domainType") },
          { key: "university", header: t("platform.fields.university"), sortable: true, hideBelow: "sm" },
          { key: "actions", header: t("common.actions"), align: "end" },
        ]}
        rows={domains.map((d) => ({
          id: d.id,
          sort: { domain: d.domain, university: d.university.name },
          cells: {
            domain: <span className="font-medium">{d.domain}</span>,
            type: <Badge tone={d.type === "ALUMNI" ? "warning" : "info"}>{t(`platform.domainTypes.${d.type}`)}</Badge>,
            university: d.university.name,
            actions: (
              <ConfirmAction
                action={removeDomainAction}
                values={{ id: d.id }}
                triggerLabel={t("common.remove")}
                title={t("platform.domains.removeTitle", { domain: d.domain })}
                description={t("platform.domains.removeBody")}
                {...confirm}
              />
            ),
          },
        }))}
        empty={<EmptyState title={t("platform.domains.empty")} />}
      />
    </>
  );
}

export default function DomainsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content />
    </Suspense>
  );
}
