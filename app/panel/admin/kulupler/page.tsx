import { Building } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { personName } from "@/app/_components/requests";
import { formLabels } from "@/app/_lib/form-labels";
import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { ActionDialog, Avatar, Badge, EmptyState, Pagination, Skeleton, Table } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { publicFileUrl } from "@/lib/storage";
import { createClubAction, listClubCategories, listClubsForAdmin } from "@/modules/club";

import { requireAdminPage } from "../admin-context";

export const generateMetadata = titled("admin.nav.clubs");

async function Content({ searchParams }: PageProps<"/panel/admin/kulupler">) {
  const [t, locale, sp, { university }] = await Promise.all([getT(), getLocale(), searchParams, requireAdminPage()]);
  const cursor = typeof sp.sonraki === "string" ? sp.sonraki.slice(0, 40) : undefined;
  const [{ items, nextCursor }, categories] = await Promise.all([listClubsForAdmin(university.id, cursor), listClubCategories()]);
  const catName = (c: { nameTr: string; nameEn: string }) => (locale === "en" ? c.nameEn : c.nameTr);

  return (
    <>
      <PageHeader
        title={t("admin.nav.clubs")}
        description={t("club.admin.body")}
        action={
          <ActionDialog
            triggerLabel={t("club.admin.create")}
            triggerVariant="primary"
            triggerSize="md"
            title={t("club.admin.create")}
            description={t("club.admin.createBody")}
            action={createClubAction}
            fields={[
              { type: "hidden", name: "universityId", value: university.id },
              { type: "text", name: "name", label: t("club.fields.name"), required: true, maxLength: 120 },
              { type: "text", name: "slug", label: t("platform.fields.slug"), hint: t("platform.fields.slugHint"), maxLength: 80 },
              { type: "select", name: "categoryId", label: t("club.fields.category"), required: true, placeholder: t("common.select"), options: categories.map((c) => ({ value: c.id, label: catName(c) })) },
              { type: "textarea", name: "shortDescTr", label: t("club.fields.shortDesc"), required: true, maxLength: 200, rows: 3 },
              { type: "email", name: "presidentEmail", label: t("club.fields.presidentEmail"), hint: t("club.fields.presidentEmailHint"), required: true, autoComplete: "off" },
            ]}
            submitLabel={t("club.admin.createSubmit")}
            {...formLabels(t)}
          />
        }
      />
      <Table
        caption={t("admin.nav.clubs")}
        columns={[
          { key: "name", header: t("club.fields.name") },
          { key: "category", header: t("club.fields.category"), hideBelow: "md" },
          { key: "president", header: t("club.fields.president"), hideBelow: "sm" },
          { key: "members", header: t("club.fields.members") },
        ]}
        rows={items.map((c) => ({
          id: c.id,
          cells: {
            name: (
              <Link href={`/panel/admin/kulupler/${c.id}`} className="flex items-center gap-(--space-3) font-semibold text-link hover:underline">
                <Avatar name={c.name} src={publicFileUrl(c.logoKey)} size="sm" shape="square" />
                <span className="min-w-0 truncate">{c.name}</span>
                {c.status !== "ACTIVE" ? <Badge tone="warning">{t(`club.status.${c.status}`)}</Badge> : null}
              </Link>
            ),
            category: catName(c.category),
            president: personName(c.president),
            members: c._count.memberships,
          },
        }))}
        empty={<EmptyState icon={<Building aria-hidden="true" className="size-(--icon-size-lg)" />} title={t("club.admin.empty")} description={t("club.admin.emptyBody")} />}
      />
      <Pagination
        firstHref={cursor ? "/panel/admin/kulupler" : undefined}
        nextHref={nextCursor ? `/panel/admin/kulupler?sonraki=${nextCursor}` : undefined}
        labels={{ label: t("common.pagination"), first: t("common.firstPage"), next: t("common.nextPage") }}
      />
    </>
  );
}

export default function AdminClubsPage(props: PageProps<"/panel/admin/kulupler">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
