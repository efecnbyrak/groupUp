import { GraduationCap } from "lucide-react";
import { Suspense } from "react";

import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { Alert, EmptyState, Skeleton, Table } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { formatDateTime } from "@/lib/dates";
import { listPendingAlumni } from "@/modules/university";

import { requireAdminPage } from "../admin-context";

export const generateMetadata = titled("admin.nav.alumni");

/** Bekleyen manuel mezun doğrulamaları — salt okunur; onay/ret F5 onay motoruyla gelir. */
async function Content() {
  const [t, locale, { university }] = await Promise.all([getT(), getLocale(), requireAdminPage()]);
  const pending = await listPendingAlumni(university.id);
  return (
    <>
      <PageHeader title={t("admin.nav.alumni")} description={t("admin.alumni.body")} />
      <Alert tone="info">{t("admin.alumni.decisionLater")}</Alert>
      <Table
        caption={t("admin.nav.alumni")}
        columns={[
          { key: "name", header: t("admin.users.person") },
          { key: "year", header: t("admin.alumni.graduationYear"), hideBelow: "sm" },
          { key: "file", header: t("admin.alumni.document"), hideBelow: "md" },
          { key: "date", header: t("admin.alumni.submittedAt") },
        ]}
        rows={pending.map((p) => {
          const name = [p.user.profile?.firstName, p.user.profile?.lastName].filter(Boolean).join(" ") || p.user.email;
          return {
            id: p.id,
            cells: {
              name: (
                <span className="flex flex-col">
                  <span className="font-medium">{name}</span>
                  <span className="text-(length:--type-caption) text-fg-secondary">{p.user.email}</span>
                </span>
              ),
              year: p.user.profile?.graduationYear ?? "—",
              file: p.fileName,
              date: formatDateTime(p.submittedAt, locale),
            },
          };
        })}
        empty={<EmptyState icon={<GraduationCap aria-hidden="true" className="size-(--icon-size-lg)" />} title={t("admin.alumni.empty")} />}
      />
    </>
  );
}

export default function AdminAlumniPage() {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content />
    </Suspense>
  );
}
