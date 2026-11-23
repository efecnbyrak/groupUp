import { notFound } from "next/navigation";
import { Suspense } from "react";

import { confirmLabels, formLabels } from "@/app/_lib/form-labels";
import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { ActionForm, Badge, Card, CardHeader, ConfirmAction, Skeleton } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { formatDate } from "@/lib/dates";
import {
  addDomainAction,
  assignAdminAction,
  getUniversity,
  removeAdminAction,
  removeDomainAction,
  setUniversityActiveAction,
  updateUniversityAction,
} from "@/modules/university";

import { universityFields } from "../university-fields";

export const generateMetadata = titled("panel.universities");

async function Content({ params }: PageProps<"/panel/platform/universiteler/[id]">) {
  const [{ id }, t, locale] = await Promise.all([params, getT(), getLocale()]);
  const university = await getUniversity(id);
  if (!university) notFound();
  const labels = formLabels(t);
  const confirm = confirmLabels(t);
  const hidden = { type: "hidden" as const, name: "universityId", value: university.id };

  return (
    <>
      <PageHeader
        title={university.name}
        description={t("platform.universities.detailBody", { users: university._count.users, faculties: university._count.faculties })}
        action={
          <div className="flex items-center gap-(--space-3)">
            {university.isActive ? <Badge tone="success">{t("platform.status.active")}</Badge> : <Badge>{t("platform.status.inactive")}</Badge>}
            <ConfirmAction
              action={setUniversityActiveAction}
              values={{ universityId: university.id, active: String(!university.isActive) }}
              triggerLabel={university.isActive ? t("platform.universities.deactivate") : t("platform.universities.activate")}
              title={university.isActive ? t("platform.universities.deactivate") : t("platform.universities.activate")}
              description={university.isActive ? t("platform.universities.deactivateBody") : t("platform.universities.activateBody")}
              variant={university.isActive ? "danger" : "primary"}
              {...confirm}
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-(--space-6) xl:grid-cols-2">
        <Card className="flex flex-col gap-(--space-4)">
          <CardHeader title={t("platform.universities.info")} />
          <ActionForm
            action={updateUniversityAction}
            fields={[hidden, ...universityFields(t, university)]}
            submitLabel={t("common.save")}
            loadingLabel={labels.loadingLabel}
          />
        </Card>

        <div className="flex flex-col gap-(--space-6)">
          <Card className="flex flex-col gap-(--space-4)">
            <CardHeader title={t("panel.domains")} description={t("platform.domains.body")} />
            {university.domains.length > 0 ? (
              <ul className="flex flex-col divide-y divide-line">
                {university.domains.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-(--space-3) py-(--space-2)">
                    <span className="flex min-w-0 items-center gap-(--space-2)">
                      <span className="truncate font-medium text-fg">{d.domain}</span>
                      <Badge tone={d.type === "ALUMNI" ? "warning" : "info"}>{t(`platform.domainTypes.${d.type}`)}</Badge>
                    </span>
                    <ConfirmAction
                      action={removeDomainAction}
                      values={{ id: d.id }}
                      triggerLabel={t("common.remove")}
                      title={t("platform.domains.removeTitle", { domain: d.domain })}
                      description={t("platform.domains.removeBody")}
                      {...confirm}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-(length:--type-body-sm) text-fg-secondary">{t("platform.domains.empty")}</p>
            )}
            <ActionForm
              action={addDomainAction}
              layout="inline"
              resetOnSuccess
              fields={[
                hidden,
                { type: "text", name: "domain", label: t("platform.fields.domain"), placeholder: "ogr.ornek.edu.tr", required: true, maxLength: 253 },
                {
                  type: "select",
                  name: "type",
                  label: t("platform.fields.domainType"),
                  required: true,
                  options: (["STUDENT", "ALUMNI"] as const).map((v) => ({ value: v, label: t(`platform.domainTypes.${v}`) })),
                },
              ]}
              submitLabel={t("common.add")}
              loadingLabel={labels.loadingLabel}
            />
          </Card>

          <Card className="flex flex-col gap-(--space-4)">
            <CardHeader title={t("panel.admins")} description={t("platform.admins.body")} />
            {university.admins.length > 0 ? (
              <ul className="flex flex-col divide-y divide-line">
                {university.admins.map((a) => {
                  const name = [a.user.profile?.firstName, a.user.profile?.lastName].filter(Boolean).join(" ") || a.user.email;
                  return (
                    <li key={a.id} className="flex items-center justify-between gap-(--space-3) py-(--space-2)">
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-fg">{name}</span>
                        <span className="truncate text-(length:--type-caption) text-fg-secondary">
                          {a.user.email} · {formatDate(a.createdAt, locale)}
                        </span>
                      </span>
                      <ConfirmAction
                        action={removeAdminAction}
                        values={{ id: a.id }}
                        triggerLabel={t("common.remove")}
                        title={t("platform.admins.removeTitle", { name })}
                        description={t("platform.admins.removeBody")}
                        {...confirm}
                      />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-(length:--type-body-sm) text-fg-secondary">{t("platform.admins.empty")}</p>
            )}
            <ActionForm
              action={assignAdminAction}
              layout="inline"
              resetOnSuccess
              fields={[hidden, { type: "email", name: "email", label: t("platform.fields.adminEmail"), required: true, autoComplete: "off" }]}
              submitLabel={t("platform.admins.assign")}
              loadingLabel={labels.loadingLabel}
            />
          </Card>
        </div>
      </div>
    </>
  );
}

export default function UniversityDetailPage(props: PageProps<"/panel/platform/universiteler/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
