import { ArrowLeft, ClipboardList, ListChecks, Trophy } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { EventStatusBadge, eventCategoryOptions } from "@/app/_components/events";
import { confirmLabels, formLabels } from "@/app/_lib/form-labels";
import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { ActionDialog, Alert, ButtonLink, ConfirmAction, Skeleton } from "@/components/ui";
import { pickMessages } from "@/i18n/messages";
import { getLocale, getT } from "@/i18n/server";
import { toIstanbulLocalInput } from "@/lib/dates";
import { publicFileUrl } from "@/lib/storage";
import { cancelRequestAction, pendingTargetsForClub, requestEventCancelAction, requestEventUpdateAction, submitEventForApprovalAction } from "@/modules/approval";
import {
  deleteEventDraftAction,
  EventWizard,
  getEventForEditor,
  listEventCategoryTree,
  saveEventDraftAction,
  uploadEventImageAction,
  WIZARD_KEYS,
  type EventContent,
  type WizardState,
} from "@/modules/event";

import { requireClubPage } from "../../club-context";

export const generateMetadata = titled("event.editor.title");

function toWizard(c: EventContent): WizardState {
  const d = (v: Date | null) => (v ? toIstanbulLocalInput(v) : "");
  const n = (v: number | null) => (v === null ? "" : String(v));
  return {
    categoryId: c.categoryId,
    titleTr: c.titleTr,
    summaryTr: c.summaryTr,
    descriptionTr: c.descriptionTr,
    coverKey: c.coverKey,
    images: c.images,
    isOnline: c.isOnline,
    locationName: c.locationName ?? "",
    locationAddress: c.locationAddress ?? "",
    mapUrl: c.mapUrl ?? "",
    onlineUrl: c.onlineUrl ?? "",
    startAt: d(c.startAt),
    endAt: d(c.endAt),
    applyOpensAt: d(c.applyOpensAt),
    applyClosesAt: d(c.applyClosesAt),
    capacity: n(c.capacity),
    waitlistEnabled: c.waitlistEnabled,
    autoPromoteWaitlist: c.autoPromoteWaitlist,
    autoAccept: c.autoAccept,
    mode: c.mode,
    teamMinSize: n(c.teamMinSize),
    teamMaxSize: n(c.teamMaxSize),
    eligibility: c.eligibility,
  };
}

/** Etkinlik sihirbazı: DRAFT → otomatik kayıt + onaya gönder; PUBLISHED → EVENT_UPDATE / iptal talebi; diğerleri salt okunur. */
async function Content({ params }: PageProps<"/panel/kulup/[slug]/etkinlikler/[id]">) {
  await connection();
  const [t, locale, { slug, id }] = await Promise.all([getT(), getLocale(), params]);
  const { club, can } = await requireClubPage(slug, "EVENT_MANAGE");
  const [event, tree, pending] = await Promise.all([getEventForEditor(club.id, id), listEventCategoryTree(), pendingTargetsForClub(club.id)]);
  if (!event) notFound();
  const base = `/panel/kulup/${club.slug}/etkinlikler`;
  const { options, leafIds } = eventCategoryOptions(tree, locale);
  const mine = pending.filter((p) => p.targetId === event.id);
  const pendingUpdate = mine.find((p) => p.type === "EVENT_UPDATE");
  const pendingCancel = mine.find((p) => p.type === "EVENT_CANCEL");
  const pendingPublish = mine.find((p) => p.type === "EVENT_PUBLISH");
  const mode = event.status === "DRAFT" ? "draft" : event.status === "PUBLISHED" && !pendingCancel ? "update" : "readonly";
  // Public dosya adresinin öneki (istemci anahtardan URL üretir): "<önek>a.webp" → "<önek>"
  const fileBase = (publicFileUrl("a.webp") ?? "/api/files/a.webp").slice(0, -"a.webp".length);

  return (
    <>
      <Link href={base} className="inline-flex items-center gap-(--space-1) text-(length:--type-body-sm) font-semibold text-link hover:underline">
        <ArrowLeft aria-hidden="true" className="size-(--icon-size-sm)" />
        {t("club.nav.events")}
      </Link>
      <PageHeader
        title={event.content.titleTr || t("event.editor.title")}
        action={
          <div className="flex flex-wrap items-center gap-(--space-3)">
            <ButtonLink href={`${base}/${event.id}/form`} variant="secondary" size="sm" icon={<ClipboardList aria-hidden="true" className="size-(--icon-size-sm)" />}>
              {t("registration.builder.title")}
            </ButtonLink>
            <ButtonLink href={`${base}/${event.id}/basvurular`} variant="secondary" size="sm" icon={<ListChecks aria-hidden="true" className="size-(--icon-size-sm)" />}>
              {t("registration.manage.title")}
            </ButtonLink>
            <ButtonLink href={`${base}/${event.id}/turnuvalar`} variant="secondary" size="sm" icon={<Trophy aria-hidden="true" className="size-(--icon-size-sm)" />}>
              {t("tournament.panel.title")}
            </ButtonLink>
            <EventStatusBadge status={event.status} t={t} />
          </div>
        }
      />
      <EventWizard
        clubId={club.id}
        eventId={event.id}
        mode={mode}
        initial={toWizard(event.content)}
        categories={options}
        leafCategoryIds={leafIds}
        fileBase={fileBase}
        previewHref={`/etkinlikler/${event.id}`}
        labels={pickMessages(t, WIZARD_KEYS)}
        saveAction={saveEventDraftAction}
        uploadAction={uploadEventImageAction}
        submitAction={submitEventForApprovalAction}
        updateAction={requestEventUpdateAction}
      >
        {pendingPublish ? (
          <Alert tone="warning">
            <div className="flex flex-wrap items-center justify-between gap-(--space-3)">
              <span>{t("event.editor.pendingPublish")}</span>
              <ConfirmAction
                action={cancelRequestAction}
                values={{ requestId: pendingPublish.id }}
                variant="secondary"
                triggerLabel={t("event.editor.withdraw")}
                title={t("event.editor.withdrawTitle")}
                description={t("event.editor.withdrawBody")}
                {...confirmLabels(t)}
              />
            </div>
          </Alert>
        ) : null}
        {pendingUpdate ? <Alert tone="warning">{t("event.editor.pendingUpdate")}</Alert> : null}
        {pendingCancel ? <Alert tone="warning">{t("event.editor.pendingCancel")}</Alert> : null}
        {event.status === "DRAFT" ? (
          <div>
            <ConfirmAction
              action={deleteEventDraftAction}
              values={{ clubId: club.id, eventId: event.id, returnTo: base }}
              triggerLabel={t("event.editor.deleteDraft")}
              title={t("event.editor.deleteDraftTitle")}
              description={t("event.editor.deleteDraftBody")}
              {...confirmLabels(t)}
            />
          </div>
        ) : null}
        {event.status === "PUBLISHED" && !pendingCancel && can("PRESIDENT") ? (
          <div>
            <ActionDialog
              triggerLabel={t("event.cancel.button")}
              triggerVariant="danger"
              title={t("event.cancel.title")}
              description={t("event.cancel.body")}
              action={requestEventCancelAction}
              submitVariant="danger"
              fields={[
                { type: "hidden", name: "clubId", value: club.id },
                { type: "hidden", name: "eventId", value: event.id },
                { type: "textarea", name: "reason", label: t("approval.reason"), required: true, rows: 4, maxLength: 500 },
              ]}
              submitLabel={t("approval.sendForApproval")}
              {...formLabels(t)}
            />
          </div>
        ) : null}
      </EventWizard>
    </>
  );
}

export default function EventEditorPage(props: PageProps<"/panel/kulup/[slug]/etkinlikler/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
