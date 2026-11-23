import "server-only";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { TicketThread } from "@/app/_components/tickets";
import { requirePageUser } from "@/app/_lib/page-user";
import { PageHeader } from "@/components/shell";
import { getLocale, getT } from "@/i18n/server";
import { getTicketForUser } from "@/modules/ticket";

/** Ticket detay sayfası gövdesi (kulüp / Admin / Platform panelleri). Erişim yoksa 404. */
export async function TicketDetail({ ticketId, backHref, backLabel, nextPath }: { ticketId: string; backHref: string; backLabel: string; nextPath: string }) {
  await connection();
  const [t, locale, user] = await Promise.all([getT(), getLocale(), requirePageUser(nextPath)]);
  const ticket = await getTicketForUser(user, ticketId);
  if (!ticket) notFound();
  return (
    <>
      <Link href={backHref} className="inline-flex items-center gap-(--space-1) text-(length:--type-body-sm) font-semibold text-link hover:underline">
        <ArrowLeft aria-hidden="true" className="size-(--icon-size-sm)" />
        {backLabel}
      </Link>
      <PageHeader title={ticket.subject} />
      <TicketThread ticket={ticket} t={t} locale={locale} viewerId={user.id} now={new Date()} />
    </>
  );
}
