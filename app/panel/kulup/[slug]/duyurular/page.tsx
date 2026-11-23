import { Megaphone, Pin } from "lucide-react";
import { Suspense } from "react";

import { confirmLabels, formLabels } from "@/app/_lib/form-labels";
import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { ActionForm, Badge, Card, ConfirmAction, EmptyState, RichText, Skeleton } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { formatDateTime } from "@/lib/dates";
import { renderRichText } from "@/lib/rich-text/sanitize";
import { createAnnouncementAction, deleteAnnouncementAction, listClubAnnouncements } from "@/modules/event";

import { requireClubPage } from "../club-context";

export const generateMetadata = titled("club.nav.announcements");

/** Duyurular (ANNOUNCEMENT_POST): onaysız yayınlanır, üyelerin akışında ve kulüp sayfasında görünür. */
async function Content({ params }: PageProps<"/panel/kulup/[slug]/duyurular">) {
  const [t, locale, { slug }] = await Promise.all([getT(), getLocale(), params]);
  const { club } = await requireClubPage(slug, "ANNOUNCEMENT_POST");
  const items = await listClubAnnouncements(club.id);
  return (
    <>
      <PageHeader title={t("club.nav.announcements")} description={t("event.announcements.body")} />
      <Card className="max-w-(--content-width-md)">
        <ActionForm
          action={createAnnouncementAction}
          resetOnSuccess
          fields={[
            { type: "hidden", name: "clubId", value: club.id },
            { type: "text", name: "titleTr", label: t("event.announcements.titleField"), required: true, maxLength: 120 },
            { type: "textarea", name: "body", label: t("event.announcements.bodyField"), hint: t("event.announcements.bodyHint"), required: true, rows: 6, maxLength: 5000 },
            { type: "checkbox", name: "pinned", label: t("event.announcements.pinned") },
          ]}
          submitLabel={t("event.announcements.publish")}
          {...formLabels(t)}
        />
      </Card>
      {items.length === 0 ? (
        <EmptyState icon={<Megaphone aria-hidden="true" className="size-(--icon-size-lg)" />} title={t("event.announcements.empty")} />
      ) : (
        <ul className="flex max-w-(--content-width-md) flex-col gap-(--space-3)">
          {items.map((a) => (
            <li key={a.id}>
              <Card className="flex flex-col gap-(--space-2)">
                <div className="flex flex-wrap items-start justify-between gap-(--space-2)">
                  <div className="flex min-w-0 flex-col gap-(--space-1)">
                    <h2 className="text-(length:--type-body) font-semibold break-words text-fg">{a.titleTr}</h2>
                    <p className="flex flex-wrap items-center gap-(--space-2) text-(length:--type-caption) text-fg-secondary">
                      {formatDateTime(a.createdAt, locale)}
                      {a.pinned ? (
                        <Badge tone="brand">
                          <Pin aria-hidden="true" className="size-(--icon-size-sm)" />
                          {t("event.announcements.pinned")}
                        </Badge>
                      ) : null}
                    </p>
                  </div>
                  <ConfirmAction
                    action={deleteAnnouncementAction}
                    values={{ clubId: club.id, id: a.id }}
                    triggerLabel={t("common.delete")}
                    title={t("event.announcements.deleteTitle")}
                    {...confirmLabels(t)}
                  />
                </div>
                <RichText sanitizedHtml={renderRichText(a.bodyTr)} className="text-(length:--type-body-sm) text-fg-secondary" />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function AnnouncementsPage(props: PageProps<"/panel/kulup/[slug]/duyurular">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
