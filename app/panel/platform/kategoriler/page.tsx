import { Suspense } from "react";

import { confirmLabels, formLabels } from "@/app/_lib/form-labels";
import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { ActionDialog, Badge, Card, CardHeader, ConfirmAction, Skeleton, Table, type FormField } from "@/components/ui";
import type { Translate } from "@/i18n/messages";
import { getT } from "@/i18n/server";
import { createClubCategoryAction, deleteClubCategoryAction, listClubCategories, updateClubCategoryAction } from "@/modules/club";
import { createEventCategoryAction, deleteEventCategoryAction, listEventCategoryTree, updateEventCategoryAction } from "@/modules/event";

export const generateMetadata = titled("panel.categories");

type Values = { nameTr?: string; nameEn?: string; slug?: string; icon?: string | null; order?: number };

function nameFields(t: Translate, v: Values = {}): FormField[] {
  return [
    { type: "text", name: "nameTr", label: t("platform.fields.nameTr"), required: true, maxLength: 80, defaultValue: v.nameTr },
    { type: "text", name: "nameEn", label: t("platform.fields.nameEn"), required: true, maxLength: 80, defaultValue: v.nameEn },
    { type: "text", name: "slug", label: t("platform.fields.slug"), hint: t("platform.fields.slugHint"), maxLength: 80, defaultValue: v.slug },
    { type: "number", name: "order", label: t("platform.fields.order"), min: 0, max: 999, defaultValue: String(v.order ?? 0) },
  ];
}

function clubFields(t: Translate, v: Values = {}): FormField[] {
  return [...nameFields(t, v), { type: "text", name: "icon", label: t("platform.fields.icon"), hint: t("platform.fields.iconHint"), maxLength: 40, defaultValue: v.icon ?? undefined }];
}

async function ClubCategories() {
  const [t, categories] = await Promise.all([getT(), listClubCategories()]);
  const labels = formLabels(t);
  const confirm = confirmLabels(t);
  return (
    <Card className="flex flex-col gap-(--space-4)">
      <CardHeader
        title={t("platform.categories.club")}
        description={t("platform.categories.clubBody")}
        action={
          <ActionDialog
            triggerLabel={t("common.add")}
            triggerVariant="primary"
            title={t("platform.categories.addClub")}
            action={createClubCategoryAction}
            fields={clubFields(t)}
            submitLabel={t("common.add")}
            {...labels}
          />
        }
      />
      <Table
        caption={t("platform.categories.club")}
        columns={[
          { key: "order", header: "#", sortable: true, align: "end" },
          { key: "name", header: t("platform.fields.name"), sortable: true },
          { key: "slug", header: t("platform.fields.slug"), hideBelow: "md" },
          { key: "actions", header: t("common.actions"), align: "end" },
        ]}
        rows={categories.map((c) => ({
          id: c.id,
          sort: { order: c.order, name: c.nameTr },
          cells: {
            order: c.order,
            name: (
              <span className="flex flex-col">
                <span className="font-medium">{c.nameTr}</span>
                <span className="text-(length:--type-caption) text-fg-secondary">{c.nameEn}</span>
              </span>
            ),
            slug: <code className="text-(length:--type-caption)">{c.slug}</code>,
            actions: (
              <span className="inline-flex gap-(--space-2)">
                <ActionDialog
                  triggerLabel={t("common.edit")}
                  title={t("platform.categories.edit", { name: c.nameTr })}
                  action={updateClubCategoryAction}
                  fields={[{ type: "hidden", name: "id", value: c.id }, ...clubFields(t, c)]}
                  submitLabel={t("common.save")}
                  {...labels}
                />
                <ConfirmAction
                  action={deleteClubCategoryAction}
                  values={{ id: c.id }}
                  triggerLabel={t("common.delete")}
                  title={t("platform.categories.deleteTitle", { name: c.nameTr })}
                  {...confirm}
                />
              </span>
            ),
          },
        }))}
      />
    </Card>
  );
}

async function EventCategories() {
  const [t, tree] = await Promise.all([getT(), listEventCategoryTree()]);
  const labels = formLabels(t);
  const confirm = confirmLabels(t);
  const row = (c: { id: string; nameTr: string; nameEn: string; slug: string; order: number }, child: boolean) => (
    <li key={c.id} className={child ? "flex items-center justify-between gap-(--space-3) py-(--space-1-5) pl-(--space-6)" : "flex items-center justify-between gap-(--space-3) py-(--space-2)"}>
      <span className="flex min-w-0 flex-col">
        <span className={child ? "truncate text-fg" : "truncate font-semibold text-fg"}>
          {c.nameTr} <span className="text-fg-secondary">· {c.nameEn}</span>
        </span>
        <code className="truncate text-(length:--type-caption) text-fg-secondary">{c.slug}</code>
      </span>
      <span className="inline-flex shrink-0 gap-(--space-2)">
        <ActionDialog
          triggerLabel={t("common.edit")}
          title={t("platform.categories.edit", { name: c.nameTr })}
          action={updateEventCategoryAction}
          fields={[{ type: "hidden", name: "id", value: c.id }, ...nameFields(t, c)]}
          submitLabel={t("common.save")}
          {...labels}
        />
        <ConfirmAction action={deleteEventCategoryAction} values={{ id: c.id }} triggerLabel={t("common.delete")} title={t("platform.categories.deleteTitle", { name: c.nameTr })} {...confirm} />
      </span>
    </li>
  );
  return (
    <Card className="flex flex-col gap-(--space-4)">
      <CardHeader
        title={t("platform.categories.event")}
        description={t("platform.categories.eventBody")}
        action={
          <ActionDialog
            triggerLabel={t("common.add")}
            triggerVariant="primary"
            title={t("platform.categories.addEvent")}
            action={createEventCategoryAction}
            fields={[
              {
                type: "select",
                name: "parentId",
                label: t("platform.fields.parent"),
                placeholder: t("platform.categories.topLevel"),
                options: tree.map((p) => ({ value: p.id, label: p.nameTr })),
              },
              ...nameFields(t),
            ]}
            submitLabel={t("common.add")}
            {...labels}
          />
        }
      />
      <ul className="flex flex-col divide-y divide-line">
        {tree.map((parent) => (
          <li key={parent.id} className="py-(--space-1)">
            <ul>
              {row(parent, false)}
              {parent.children.map((c) => row(c, true))}
              {parent.children.length === 0 ? (
                <li className="py-(--space-1) pl-(--space-6)">
                  <Badge>{t("platform.categories.noChildren")}</Badge>
                </li>
              ) : null}
            </ul>
          </li>
        ))}
      </ul>
    </Card>
  );
}

async function Header() {
  const t = await getT();
  return <PageHeader title={t("panel.categories")} description={t("platform.categories.body")} />;
}

export default function CategoriesPage() {
  return (
    <>
      <Suspense fallback={null}>
        <Header />
      </Suspense>
      <div className="grid grid-cols-1 gap-(--space-6) xl:grid-cols-2">
        <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
          <ClubCategories />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
          <EventCategories />
        </Suspense>
      </div>
    </>
  );
}
