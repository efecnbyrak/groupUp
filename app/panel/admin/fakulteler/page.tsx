import { Landmark } from "lucide-react";
import { Suspense } from "react";

import { confirmLabels, formLabels } from "@/app/_lib/form-labels";
import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { ActionDialog, ActionForm, Badge, Card, ConfirmAction, EmptyState, Skeleton, type FormField } from "@/components/ui";
import type { Translate } from "@/i18n/messages";
import { getT } from "@/i18n/server";
import {
  createDepartmentAction,
  createFacultyAction,
  deleteDepartmentAction,
  deleteFacultyAction,
  listFacultiesForAdmin,
  updateDepartmentAction,
  updateFacultyAction,
} from "@/modules/university";

import { requireAdminPage } from "../admin-context";

export const generateMetadata = titled("admin.nav.faculties");

const nameFields = (t: Translate, v: { nameTr?: string; nameEn?: string | null } = {}): FormField[] => [
  { type: "text", name: "nameTr", label: t("platform.fields.nameTr"), required: true, maxLength: 150, defaultValue: v.nameTr },
  { type: "text", name: "nameEn", label: t("platform.fields.nameEn"), maxLength: 150, defaultValue: v.nameEn ?? undefined },
];

async function Content() {
  const [t, { university }] = await Promise.all([getT(), requireAdminPage()]);
  const faculties = await listFacultiesForAdmin(university.id);
  const labels = formLabels(t);
  const confirm = confirmLabels(t);
  const uni = { type: "hidden" as const, name: "universityId", value: university.id };

  return (
    <>
      <PageHeader
        title={t("admin.nav.faculties")}
        description={t("admin.faculties.body")}
        action={
          <ActionDialog
            triggerLabel={t("admin.faculties.add")}
            triggerVariant="primary"
            triggerSize="md"
            title={t("admin.faculties.add")}
            action={createFacultyAction}
            fields={[uni, ...nameFields(t)]}
            submitLabel={t("common.add")}
            {...labels}
          />
        }
      />
      {faculties.length === 0 ? (
        <EmptyState icon={<Landmark aria-hidden="true" className="size-(--icon-size-lg)" />} title={t("admin.faculties.empty")} />
      ) : (
        <ul className="flex flex-col gap-(--space-4)">
          {faculties.map((f) => (
            <li key={f.id}>
              <Card className="flex flex-col gap-(--space-4)">
                <div className="flex flex-wrap items-start justify-between gap-(--space-3)">
                  <div className="flex min-w-0 flex-col gap-(--space-1)">
                    <h2 className="text-(length:--type-heading-sm) font-semibold text-fg">{f.nameTr}</h2>
                    <p className="text-(length:--type-body-sm) text-fg-secondary">
                      {f.nameEn ?? "—"} · {t("admin.faculties.members", { count: f._count.profiles })}
                    </p>
                  </div>
                  <span className="flex gap-(--space-2)">
                    <ActionDialog
                      triggerLabel={t("common.edit")}
                      title={t("platform.categories.edit", { name: f.nameTr })}
                      action={updateFacultyAction}
                      fields={[uni, { type: "hidden", name: "id", value: f.id }, ...nameFields(t, f)]}
                      submitLabel={t("common.save")}
                      {...labels}
                    />
                    <ConfirmAction
                      action={deleteFacultyAction}
                      values={{ universityId: university.id, id: f.id }}
                      triggerLabel={t("common.delete")}
                      title={t("platform.categories.deleteTitle", { name: f.nameTr })}
                      description={t("admin.faculties.deleteBody")}
                      {...confirm}
                    />
                  </span>
                </div>
                <ul className="flex flex-col divide-y divide-line border-t border-line">
                  {f.departments.map((d) => (
                    <li key={d.id} className="flex flex-col gap-(--space-2) py-(--space-2) sm:flex-row sm:items-center sm:justify-between sm:gap-(--space-3)">
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-fg">{d.nameTr}</span>
                        <span className="truncate text-(length:--type-caption) text-fg-secondary">{d.nameEn ?? "—"}</span>
                      </span>
                      <span className="flex items-center gap-(--space-2)">
                        <Badge>{t("admin.faculties.members", { count: d._count.profiles })}</Badge>
                        <ActionDialog
                          triggerLabel={t("common.edit")}
                          title={t("platform.categories.edit", { name: d.nameTr })}
                          action={updateDepartmentAction}
                          fields={[uni, { type: "hidden", name: "id", value: d.id }, ...nameFields(t, d)]}
                          submitLabel={t("common.save")}
                          {...labels}
                        />
                        <ConfirmAction
                          action={deleteDepartmentAction}
                          values={{ universityId: university.id, id: d.id }}
                          triggerLabel={t("common.delete")}
                          title={t("platform.categories.deleteTitle", { name: d.nameTr })}
                          description={t("admin.faculties.deleteBody")}
                          {...confirm}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
                <ActionForm
                  action={createDepartmentAction}
                  layout="inline"
                  resetOnSuccess
                  fields={[
                    uni,
                    { type: "hidden", name: "facultyId", value: f.id },
                    { type: "text", name: "nameTr", label: t("admin.faculties.departmentTr"), required: true, maxLength: 150 },
                    { type: "text", name: "nameEn", label: t("admin.faculties.departmentEn"), maxLength: 150 },
                  ]}
                  submitLabel={t("admin.faculties.addDepartment")}
                  loadingLabel={labels.loadingLabel}
                />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function FacultiesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content />
    </Suspense>
  );
}
