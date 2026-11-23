import { Suspense } from "react";

import { confirmLabels } from "@/app/_lib/form-labels";
import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { ActionForm, Card, ConfirmAction, EmptyState, Skeleton, Table } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { formatDate } from "@/lib/dates";
import { assignAdminAction, listAllAdmins, listUniversities, removeAdminAction } from "@/modules/university";

export const generateMetadata = titled("panel.admins");

async function Content() {
  const [t, locale, admins, universities] = await Promise.all([getT(), getLocale(), listAllAdmins(), listUniversities()]);
  const confirm = confirmLabels(t);
  return (
    <>
      <PageHeader title={t("panel.admins")} description={t("platform.admins.body")} />
      <Card>
        <ActionForm
          action={assignAdminAction}
          layout="inline"
          resetOnSuccess
          fields={[
            { type: "select", name: "universityId", label: t("platform.fields.university"), required: true, placeholder: t("common.select"), options: universities.map((u) => ({ value: u.id, label: u.name })) },
            { type: "email", name: "email", label: t("platform.fields.adminEmail"), required: true, autoComplete: "off" },
          ]}
          submitLabel={t("platform.admins.assign")}
          loadingLabel={confirm.loadingLabel}
        />
      </Card>
      <Table
        caption={t("panel.admins")}
        columns={[
          { key: "name", header: t("platform.fields.person"), sortable: true },
          { key: "university", header: t("platform.fields.university"), sortable: true, hideBelow: "sm" },
          { key: "since", header: t("platform.fields.since"), hideBelow: "md" },
          { key: "actions", header: t("common.actions"), align: "end" },
        ]}
        rows={admins.map((a) => {
          const name = [a.user.profile?.firstName, a.user.profile?.lastName].filter(Boolean).join(" ") || a.user.email;
          return {
            id: a.id,
            sort: { name, university: a.university.name },
            cells: {
              name: (
                <span className="flex flex-col">
                  <span className="font-medium">{name}</span>
                  <span className="text-(length:--type-caption) text-fg-secondary">{a.user.email}</span>
                </span>
              ),
              university: a.university.name,
              since: formatDate(a.createdAt, locale),
              actions: (
                <ConfirmAction
                  action={removeAdminAction}
                  values={{ id: a.id }}
                  triggerLabel={t("common.remove")}
                  title={t("platform.admins.removeTitle", { name })}
                  description={t("platform.admins.removeBody")}
                  {...confirm}
                />
              ),
            },
          };
        })}
        empty={<EmptyState title={t("platform.admins.empty")} />}
      />
    </>
  );
}

export default function AdminsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content />
    </Suspense>
  );
}
