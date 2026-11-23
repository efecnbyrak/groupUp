import { Suspense } from "react";

import { openTicketFields, TicketTable } from "@/app/_components/tickets";
import { formLabels } from "@/app/_lib/form-labels";
import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { ActionDialog, Skeleton } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { listClubTickets, openClubTicketAction } from "@/modules/ticket";

import { requireClubPage } from "../club-context";

export const generateMetadata = titled("panel.support");

/** Kulüp → Admin ticketları (Başkan / TICKET_OPEN). */
async function Content({ params }: PageProps<"/panel/kulup/[slug]/destek">) {
  const [t, locale, { slug }] = await Promise.all([getT(), getLocale(), params]);
  const { club } = await requireClubPage(slug, "TICKET_OPEN");
  const { items } = await listClubTickets(club.id);
  const base = `/panel/kulup/${club.slug}/destek`;
  return (
    <>
      <PageHeader
        title={t("panel.support")}
        description={t("ticket.clubBody")}
        action={
          <ActionDialog
            triggerLabel={t("ticket.openToAdmin")}
            triggerVariant="primary"
            triggerSize="md"
            title={t("ticket.openToAdmin")}
            action={openClubTicketAction}
            fields={openTicketFields(t, { clubId: club.id, returnTo: base })}
            submitLabel={t("ticket.open")}
            {...formLabels(t)}
          />
        }
      />
      <TicketTable items={items} basePath={base} t={t} locale={locale} />
    </>
  );
}

export default function ClubSupportPage(props: PageProps<"/panel/kulup/[slug]/destek">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
