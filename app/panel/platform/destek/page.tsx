import { notFound } from "next/navigation";
import { Suspense } from "react";

import { TicketTable } from "@/app/_components/tickets";
import { titled } from "@/app/_lib/metadata";
import { requirePageUser } from "@/app/_lib/page-user";
import { PageHeader } from "@/components/shell";
import { Pagination, Skeleton } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { listPlatformTickets } from "@/modules/ticket";

export const generateMetadata = titled("panel.support");

/** Platform destek: Üniversite Adminlerinin açtığı ticketlar (ADMIN_TO_PLATFORM). */
async function Content({ searchParams }: PageProps<"/panel/platform/destek">) {
  const [t, locale, sp, user] = await Promise.all([getT(), getLocale(), searchParams, requirePageUser("/panel/platform/destek")]);
  if (user.platformRole !== "SUPER_ADMIN") notFound();
  const cursor = typeof sp.sonraki === "string" ? sp.sonraki.slice(0, 40) : undefined;
  const { items, nextCursor } = await listPlatformTickets(undefined, cursor);
  return (
    <>
      <PageHeader title={t("panel.support")} description={t("ticket.platformBody")} />
      <TicketTable items={items} basePath="/panel/platform/destek" t={t} locale={locale} />
      <Pagination
        firstHref={cursor ? "/panel/platform/destek" : undefined}
        nextHref={nextCursor ? `/panel/platform/destek?sonraki=${nextCursor}` : undefined}
        labels={{ label: t("common.pagination"), first: t("common.firstPage"), next: t("common.nextPage") }}
      />
    </>
  );
}

export default function PlatformSupportPage(props: PageProps<"/panel/platform/destek">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
