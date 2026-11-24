import { Swords } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { titled } from "@/app/_lib/metadata";
import { requirePageUser } from "@/app/_lib/page-user";
import { Badge, EmptyState, Skeleton, type BadgeTone } from "@/components/ui";
import type { MessageKey } from "@/i18n/messages";
import { getLocale, getT } from "@/i18n/server";
import { formatDateTime } from "@/lib/dates";
import { getMyMatches } from "@/modules/tournament";

export const generateMetadata = titled("tournament.myMatches.title");

const STATUS_TONE: Record<string, BadgeTone> = { COMPLETED: "success", WALKOVER: "info", POSTPONED: "warning" };

/** Maçlarım (TOURNAMENTS §6): bireysel/takım katılımcısı olunan tüm turnuvalardaki maçlar. */
async function Content() {
  const user = await requirePageUser("/maclarim");
  await connection();
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const items = await getMyMatches(user.id);

  return (
    <>
      <div className="flex flex-col gap-(--space-1)">
        <h1 className="text-(length:--type-heading-xl) font-semibold text-fg">{t("tournament.myMatches.title")}</h1>
        <p className="text-fg-secondary">{t("tournament.myMatches.body")}</p>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<Swords aria-hidden="true" className="size-(--icon-size-lg)" />} title={t("tournament.myMatches.empty")} description={t("tournament.myMatches.emptyBody")} />
      ) : (
        <ul className="flex flex-col gap-(--space-3)">
          {items.map(({ match, tournament }) => (
            <li key={match.id}>
              <Link
                href={tournament ? `/turnuva/${match.stage.tournamentId}` : "#"}
                className="flex flex-col gap-(--space-1) rounded-card border border-line bg-card p-(--space-4) transition-shadow duration-(--duration-fast) hover:shadow-(--elevation-md)"
              >
                <div className="flex flex-wrap items-center justify-between gap-(--space-2)">
                  <span className="text-(length:--type-caption) text-fg-secondary">
                    {tournament?.event.club.name} · {tournament?.event.titleTr} · {tournament?.name}
                  </span>
                  {match.status === "PENDING" ? null : <Badge tone={STATUS_TONE[match.status] ?? "neutral"}>{t(`tournament.status.${match.status}` as MessageKey)}</Badge>}
                </div>
                <div className="flex items-center gap-(--space-3) font-semibold text-fg">
                  <span>{match.homeScore !== null ? `${match.homeScore} — ${match.awayScore}` : t("tournament.match.pending")}</span>
                </div>
                {match.scheduledAt ? <span className="text-(length:--type-caption) text-fg-secondary">{formatDateTime(match.scheduledAt, locale)}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function MyMatchesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content />
    </Suspense>
  );
}
