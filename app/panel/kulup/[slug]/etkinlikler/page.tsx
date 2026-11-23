import { CalendarPlus } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";

import { EventGrid, eventCategoryOptions } from "@/app/_components/events";
import { formLabels } from "@/app/_lib/form-labels";
import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { ActionDialog, EmptyState, Skeleton } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { createEventAction, EVENT_TITLE_MAX, listClubEvents, listEventCategoryTree } from "@/modules/event";

import { requireClubPage } from "../club-context";

export const generateMetadata = titled("club.nav.events");

/** Kulüp paneli → Etkinlikler (EVENT_MANAGE): tüm durumlar + yeni taslak. */
async function Content({ params }: PageProps<"/panel/kulup/[slug]/etkinlikler">) {
  await connection();
  const [t, locale, { slug }] = await Promise.all([getT(), getLocale(), params]);
  const { club } = await requireClubPage(slug, "EVENT_MANAGE");
  const [events, tree] = await Promise.all([listClubEvents(club.id), listEventCategoryTree()]);
  const base = `/panel/kulup/${club.slug}/etkinlikler`;
  const { options } = eventCategoryOptions(tree, locale);
  const create = (
    <ActionDialog
      triggerLabel={t("event.create.button")}
      triggerVariant="primary"
      triggerSize="md"
      title={t("event.create.title")}
      description={t("event.create.body")}
      action={createEventAction}
      fields={[
        { type: "hidden", name: "clubId", value: club.id },
        { type: "hidden", name: "returnTo", value: base },
        { type: "select", name: "categoryId", label: t("event.fields.category"), required: true, options, placeholder: t("common.select") },
        { type: "text", name: "titleTr", label: t("event.fields.title"), required: true, maxLength: EVENT_TITLE_MAX },
      ]}
      submitLabel={t("event.create.submit")}
      {...formLabels(t)}
    />
  );
  return (
    <>
      <PageHeader title={t("club.nav.events")} description={t("event.panel.body")} action={create} />
      {events.length === 0 ? (
        <EmptyState icon={<CalendarPlus aria-hidden="true" className="size-(--icon-size-lg)" />} title={t("event.panel.empty")} description={t("event.panel.emptyBody")} />
      ) : (
        <EventGrid events={events} t={t} locale={locale} now={new Date()} hrefFor={(id) => `${base}/${id}`} showStatus />
      )}
    </>
  );
}

export default function ClubEventsPage(props: PageProps<"/panel/kulup/[slug]/etkinlikler">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
