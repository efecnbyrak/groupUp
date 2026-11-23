import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { Badge, ButtonLink, EmptyState, Skeleton, Table } from "@/components/ui";
import { getT } from "@/i18n/server";
import { listUniversities } from "@/modules/university";

export const generateMetadata = titled("panel.universities");

async function Content() {
  const [t, universities] = await Promise.all([getT(), listUniversities()]);
  return (
    <>
      <PageHeader
        title={t("panel.universities")}
        description={t("platform.universities.body")}
        action={
          <ButtonLink href="/panel/platform/universiteler/yeni" icon={<Plus aria-hidden="true" className="size-(--icon-size-sm)" />}>
            {t("platform.universities.add")}
          </ButtonLink>
        }
      />
      <Table
        caption={t("panel.universities")}
        columns={[
          { key: "name", header: t("platform.fields.name"), sortable: true },
          { key: "city", header: t("platform.fields.city"), sortable: true, hideBelow: "md" },
          { key: "domains", header: t("panel.domains"), hideBelow: "lg" },
          { key: "users", header: t("platform.fields.users"), sortable: true, align: "end", hideBelow: "sm" },
          { key: "status", header: t("platform.fields.status") },
        ]}
        rows={universities.map((u) => ({
          id: u.id,
          sort: { name: u.name, city: u.city ?? "", users: u._count.users },
          cells: {
            name: (
              <Link href={`/panel/platform/universiteler/${u.id}`} className="font-semibold text-link hover:underline">
                {u.name}
              </Link>
            ),
            city: u.city ?? "—",
            domains: (
              <span className="flex flex-wrap gap-(--space-1)">
                {u.domains.map((d) => (
                  <Badge key={d.id} tone={d.type === "ALUMNI" ? "warning" : "info"}>
                    {d.domain}
                  </Badge>
                ))}
              </span>
            ),
            users: u._count.users,
            status: u.isActive ? <Badge tone="success">{t("platform.status.active")}</Badge> : <Badge>{t("platform.status.inactive")}</Badge>,
          },
        }))}
        empty={<EmptyState title={t("platform.universities.empty")} />}
      />
    </>
  );
}

export default function UniversitiesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content />
    </Suspense>
  );
}
