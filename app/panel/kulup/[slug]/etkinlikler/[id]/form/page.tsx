import { ArrowLeft, ClipboardList } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { confirmLabels, formLabels } from "@/app/_lib/form-labels";
import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { ActionDialog, ActionForm, Badge, Card, CardHeader, ConfirmAction, EmptyState, Skeleton, type FormField, type SelectOption } from "@/components/ui";
import type { MessageKey, Translate } from "@/i18n/messages";
import { getT } from "@/i18n/server";
import { getEventForEditor } from "@/modules/event";
import {
  applyFormTemplateAction,
  createFormFieldAction,
  deleteFormFieldAction,
  FORM_FIELD_TYPES,
  FORM_TEMPLATES,
  listFields,
  reorderFormFieldAction,
  toggleFormFieldAction,
  updateFormFieldAction,
  type FieldConfig,
  type FieldOption,
} from "@/modules/registration";

import { requireClubPage } from "../../../club-context";

export const generateMetadata = titled("registration.builder.title");

type FieldRow = Awaited<ReturnType<typeof listFields>>[number];

function fieldDialogFields(t: Translate, isTeamEvent: boolean, v?: FieldRow): FormField[] {
  const cfg = (v?.config as FieldConfig | null) ?? null;
  const opts = (v?.options as FieldOption[] | null) ?? [];
  const optionsText = opts.map((o) => (o.labelEn && o.labelEn !== o.labelTr ? `${o.labelTr}|${o.labelEn}` : o.labelTr)).join("\n");
  const typeOptions: SelectOption[] = FORM_FIELD_TYPES.map((ft) => ({ value: ft, label: t(`registration.fieldTypes.${ft}` as MessageKey) }));
  return [
    { type: "select", name: "type", label: t("registration.builder.fieldType"), required: true, options: typeOptions, defaultValue: v?.type },
    { type: "text", name: "labelTr", label: t("registration.builder.label"), required: true, maxLength: 120, defaultValue: v?.labelTr },
    { type: "textarea", name: "helpTr", label: t("registration.builder.help"), rows: 2, maxLength: 300, defaultValue: v?.helpTr ?? undefined },
    { type: "checkbox", name: "required", label: t("registration.builder.required"), defaultChecked: v?.required },
    ...((isTeamEvent ? [{ type: "checkbox" as const, name: "teamLevel", label: t("registration.builder.teamLevel"), defaultChecked: v?.teamLevel }] : [])),
    { type: "textarea", name: "optionsText", label: t("registration.builder.options"), hint: t("registration.builder.optionsHint"), rows: 4, maxLength: 4000, defaultValue: optionsText },
    { type: "number", name: "maxLength", label: t("registration.builder.maxLength"), min: 1, max: 10000, defaultValue: cfg?.maxLength !== undefined ? String(cfg.maxLength) : undefined },
    { type: "number", name: "min", label: t("registration.builder.min"), defaultValue: cfg?.min !== undefined ? String(cfg.min) : undefined },
    { type: "number", name: "max", label: t("registration.builder.max"), defaultValue: cfg?.max !== undefined ? String(cfg.max) : undefined },
    { type: "checkbox", name: "integer", label: t("registration.builder.integer"), defaultChecked: cfg?.integer },
    { type: "number", name: "minSelect", label: t("registration.builder.minSelect"), min: 0, max: 20, defaultValue: cfg?.minSelect !== undefined ? String(cfg.minSelect) : undefined },
    { type: "number", name: "maxSelect", label: t("registration.builder.maxSelect"), min: 1, max: 20, defaultValue: cfg?.maxSelect !== undefined ? String(cfg.maxSelect) : undefined },
    { type: "number", name: "maxMb", label: t("registration.builder.maxMb"), min: 1, max: 10, defaultValue: cfg?.maxMb !== undefined ? String(cfg.maxMb) : undefined },
    { type: "checkbox", name: "acceptPdf", label: t("registration.builder.acceptPdf"), defaultChecked: cfg?.accept?.includes("pdf") },
    { type: "checkbox", name: "acceptImage", label: t("registration.builder.acceptImage"), defaultChecked: cfg?.accept?.some((a) => a !== "pdf") },
  ];
}

/** Kulüp paneli: başvuru formu oluşturucu (EVENT_MANAGE). Alan tipleri, zorunluluk, hazır şablonlar. */
async function Content({ params }: PageProps<"/panel/kulup/[slug]/etkinlikler/[id]/form">) {
  await connection();
  const [t, { slug, id }] = await Promise.all([getT(), params]);
  const { club } = await requireClubPage(slug, "EVENT_MANAGE");
  const event = await getEventForEditor(club.id, id);
  if (!event) notFound();
  const fields = await listFields(club.id, id);
  const base = `/panel/kulup/${club.slug}/etkinlikler/${id}`;
  const isTeamEvent = event.content.mode === "TEAM";
  const labels = formLabels(t);
  const confirm = confirmLabels(t);

  return (
    <>
      <Link href={base} className="inline-flex items-center gap-(--space-1) text-(length:--type-body-sm) font-semibold text-link hover:underline">
        <ArrowLeft aria-hidden="true" className="size-(--icon-size-sm)" />
        {event.content.titleTr || t("event.editor.title")}
      </Link>
      <PageHeader
        title={t("registration.builder.title")}
        description={t("registration.builder.body")}
        action={
          <ActionDialog
            triggerLabel={t("registration.builder.addField")}
            triggerVariant="primary"
            title={t("registration.builder.addField")}
            action={createFormFieldAction}
            fields={[{ type: "hidden", name: "clubId", value: club.id }, { type: "hidden", name: "eventId", value: id }, ...fieldDialogFields(t, isTeamEvent)]}
            submitLabel={t("registration.builder.save")}
            {...labels}
          />
        }
      />

      <Card className="flex flex-col gap-(--space-3)">
        <CardHeader title={t("registration.builder.templates")} />
        <div className="flex flex-wrap gap-(--space-2)">
          {FORM_TEMPLATES.map((tpl) => (
            <ActionForm
              key={tpl.key}
              action={applyFormTemplateAction}
              layout="inline"
              fields={[
                { type: "hidden", name: "clubId", value: club.id },
                { type: "hidden", name: "eventId", value: id },
                { type: "hidden", name: "templateKey", value: tpl.key },
              ]}
              submitLabel={tpl.labelTr}
              submitVariant="secondary"
              {...labels}
            />
          ))}
        </div>
      </Card>

      {fields.length === 0 ? (
        <EmptyState icon={<ClipboardList aria-hidden="true" className="size-(--icon-size-lg)" />} title={t("registration.builder.empty")} description={t("registration.builder.emptyBody")} />
      ) : (
        <ul className="flex flex-col gap-(--space-2)">
          {fields.map((f, i) => (
            <li key={f.id}>
              <Card className="flex flex-wrap items-center justify-between gap-(--space-3)">
                <div className="flex min-w-0 flex-col gap-(--space-1)">
                  <div className="flex flex-wrap items-center gap-(--space-2)">
                    <span className="font-semibold text-fg">{f.labelTr}</span>
                    <Badge tone="neutral">{t(`registration.fieldTypes.${f.type}` as MessageKey)}</Badge>
                    {f.required ? <Badge tone="warning">{t("registration.builder.required")}</Badge> : null}
                    {f.teamLevel ? <Badge tone="info">{t("registration.builder.teamLevel")}</Badge> : null}
                    {f.hidden ? <Badge tone="danger">{t("registration.builder.hidden")}</Badge> : null}
                  </div>
                  {f.helpTr ? <p className="text-(length:--type-caption) text-fg-secondary">{f.helpTr}</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-(--space-2)">
                  {i > 0 ? <IconFormButton action={reorderFormFieldAction} values={{ clubId: club.id, eventId: id, id: f.id, direction: "up" }} label={t("registration.builder.up")} /> : null}
                  {i < fields.length - 1 ? <IconFormButton action={reorderFormFieldAction} values={{ clubId: club.id, eventId: id, id: f.id, direction: "down" }} label={t("registration.builder.down")} /> : null}
                  <IconFormButton
                    action={toggleFormFieldAction}
                    values={{ clubId: club.id, eventId: id, id: f.id, hidden: String(f.hidden) }}
                    label={f.hidden ? t("registration.builder.show") : t("registration.builder.hide")}
                  />
                  <ActionDialog
                    triggerLabel={t("common.edit")}
                    triggerSize="sm"
                    title={t("registration.builder.editField")}
                    action={updateFormFieldAction}
                    fields={[
                      { type: "hidden", name: "clubId", value: club.id },
                      { type: "hidden", name: "eventId", value: id },
                      { type: "hidden", name: "id", value: f.id },
                      ...fieldDialogFields(t, isTeamEvent, f),
                    ]}
                    submitLabel={t("registration.builder.save")}
                    {...labels}
                  />
                  <ConfirmAction
                    action={deleteFormFieldAction}
                    values={{ clubId: club.id, eventId: id, id: f.id }}
                    triggerLabel={t("registration.builder.delete")}
                    title={t("registration.builder.deleteTitle")}
                    description={t("registration.builder.deleteBody")}
                    {...confirm}
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Tek alanlı anlık form (etiket metniyle küçük düğme) — sırala/gizle-göster. */
function IconFormButton({ action, values, label }: { action: Parameters<typeof ActionForm>[0]["action"]; values: Record<string, string>; label: string }) {
  return (
    <ActionForm
      action={action}
      layout="inline"
      fields={Object.entries(values).map(([name, value]) => ({ type: "hidden" as const, name, value }))}
      submitLabel={label}
      submitVariant="ghost"
      loadingLabel=""
    />
  );
}

export default function FormBuilderPage(props: PageProps<"/panel/kulup/[slug]/etkinlikler/[id]/form">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
