import { Suspense } from "react";

import { titled } from "@/app/_lib/metadata";
import { TicketDetail } from "@/app/_lib/ticket-page";
import { Skeleton } from "@/components/ui";
import { getT } from "@/i18n/server";

export const generateMetadata = titled("panel.support");

async function Content({ params }: PageProps<"/panel/platform/destek/[id]">) {
  const [t, { id }] = await Promise.all([getT(), params]);
  return <TicketDetail ticketId={id} backHref="/panel/platform/destek" backLabel={t("panel.support")} nextPath={`/panel/platform/destek/${id}`} />;
}

export default function PlatformTicketPage(props: PageProps<"/panel/platform/destek/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
