import { Suspense } from "react";

import { titled } from "@/app/_lib/metadata";
import { TicketDetail } from "@/app/_lib/ticket-page";
import { Skeleton } from "@/components/ui";
import { getT } from "@/i18n/server";

import { requireClubPage } from "../../club-context";

export const generateMetadata = titled("panel.support");

async function Content({ params }: PageProps<"/panel/kulup/[slug]/destek/[id]">) {
  const [t, { slug, id }] = await Promise.all([getT(), params]);
  const { club } = await requireClubPage(slug, "TICKET_OPEN");
  const base = `/panel/kulup/${club.slug}/destek`;
  return <TicketDetail ticketId={id} backHref={base} backLabel={t("panel.support")} nextPath={`${base}/${id}`} />;
}

export default function ClubTicketPage(props: PageProps<"/panel/kulup/[slug]/destek/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
