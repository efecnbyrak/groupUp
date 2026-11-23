import { Suspense } from "react";

import { titled } from "@/app/_lib/metadata";
import { TicketDetail } from "@/app/_lib/ticket-page";
import { Skeleton } from "@/components/ui";
import { getT } from "@/i18n/server";

export const generateMetadata = titled("panel.support");

async function Content({ params }: PageProps<"/panel/admin/destek/[id]">) {
  const [t, { id }] = await Promise.all([getT(), params]);
  return <TicketDetail ticketId={id} backHref="/panel/admin/destek" backLabel={t("panel.support")} nextPath={`/panel/admin/destek/${id}`} />;
}

export default function AdminTicketPage(props: PageProps<"/panel/admin/destek/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
