import { Suspense } from "react";

import { openTicketFields, TicketTable } from "@/app/_components/tickets";
import { formLabels } from "@/app/_lib/form-labels";
import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { ActionDialog, Skeleton } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { listAdminInbox, listAdminOutbox, openAdminTicketAction } from "@/modules/ticket";

import { requireAdminPage } from "../admin-context";

export const generateMetadata = titled("panel.support");

/** Admin destek: kulüplerden gelen ticketlar + Süper Admin'e açılanlar. */
async function Content() {
  const [t, locale, { university }] = await Promise.all([getT(), getLocale(), requireAdminPage()]);
  const [inbox, outbox] = await Promise.all([listAdminInbox(university.id), listAdminOutbox(university.id)]);
  return (
    <>
      <PageHeader
        title={t("panel.support")}
        description={t("ticket.adminBody")}
        action={
          <ActionDialog
            triggerLabel={t("ticket.openToPlatform")}
            triggerVariant="primary"
            triggerSize="md"
            title={t("ticket.openToPlatform")}
            action={openAdminTicketAction}
            fields={openTicketFields(t, { universityId: university.id })}
            submitLabel={t("ticket.open")}
            {...formLabels(t)}
          />
        }
      />
      <section className="flex flex-col gap-(--space-3)">
        <h2 className="text-(length:--type-heading-sm) font-semibold text-fg">{t("ticket.fromClubs")}</h2>
        <TicketTable items={inbox.items} basePath="/panel/admin/destek" t={t} locale={locale} showClub />
      </section>
      <section className="flex flex-col gap-(--space-3)">
        <h2 className="text-(length:--type-heading-sm) font-semibold text-fg">{t("ticket.toPlatform")}</h2>
        <TicketTable items={outbox.items} basePath="/panel/admin/destek" t={t} locale={locale} />
      </section>
    </>
  );
}

export default function AdminSupportPage() {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content />
    </Suspense>
  );
}
