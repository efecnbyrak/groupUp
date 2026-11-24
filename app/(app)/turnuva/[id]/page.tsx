import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { Badge, Card, CardHeader, EmptyState, Skeleton, type BadgeTone } from "@/components/ui";
import type { MessageKey } from "@/i18n/messages";
import { getT } from "@/i18n/server";
import { getSessionUser } from "@/lib/authz";
import {
  BracketView,
  FixtureList,
  getPublicTournament,
  getStageMatches,
  getStandings,
  StandingsTable,
} from "@/modules/tournament";

export async function generateMetadata({ params }: PageProps<"/turnuva/[id]">): Promise<Metadata> {
  const { id } = await params;
  const t = await getPublicTournament(id);
  return { title: t ? `${t.name} — groupUp` : "groupUp" };
}

const STATUS_TONE: Record<string, BadgeTone> = { DRAFT: "neutral", SEEDED: "info", IN_PROGRESS: "warning", COMPLETED: "success", CANCELLED: "danger" };

/** Herkese açık turnuva sayfası (TOURNAMENTS §6): isPublic turnuva, giriş gerektirmez, salt okunur. */
async function Content({ params }: PageProps<"/turnuva/[id]">) {
  await connection();
  const [t, { id }, viewer] = await Promise.all([getT(), params, getSessionUser()]);
  const tournament = await getPublicTournament(id, viewer?.id);
  if (!tournament) notFound();
  const names = new Map(tournament.participants.map((p) => [p.id, p.displayName]));
  const standingsLabels = {
    rank: t("tournament.standings.rank"),
    participant: t("tournament.standings.participant"),
    played: t("tournament.standings.played"),
    wins: t("tournament.standings.wins"),
    draws: t("tournament.standings.draws"),
    losses: t("tournament.standings.losses"),
    goalsFor: t("tournament.standings.goalsFor"),
    goalsAgainst: t("tournament.standings.goalsAgainst"),
    goalDiff: t("tournament.standings.goalDiff"),
    points: t("tournament.standings.points"),
    form: t("tournament.standings.form"),
    formLabels: { W: t("tournament.standings.win"), D: t("tournament.standings.draw"), L: t("tournament.standings.loss") },
  };

  return (
    <article className="flex flex-col gap-(--space-6)">
      <div className="flex flex-col gap-(--space-1)">
        <div className="flex flex-wrap items-center gap-(--space-2)">
          <span className="text-(length:--type-body-sm) text-fg-secondary">
            {tournament.event.club.name} · {tournament.event.titleTr}
          </span>
          <Badge tone={STATUS_TONE[tournament.status] ?? "neutral"}>{t(`tournament.status.${tournament.status}` as MessageKey)}</Badge>
        </div>
        <h1 className="text-(length:--type-heading-xl) font-semibold break-words text-fg">{tournament.name}</h1>
        <p className="text-fg-secondary">{t(`tournament.format.${tournament.format}` as MessageKey)}</p>
      </div>

      {tournament.stages.length === 0 ? (
        <EmptyState title={t("tournament.panel.empty")} />
      ) : (
        <div className="flex flex-col gap-(--space-6)">
          {await Promise.all(
            tournament.stages.map(async (stage) => {
              const matches = await getStageMatches(stage.id);
              if (stage.groups.length > 0) {
                const groupData = await Promise.all(stage.groups.map((g) => getStandings(tournament.settings, { groupId: g.id })));
                return (
                  <Card key={stage.id} className="flex flex-col gap-(--space-6)">
                    <CardHeader title={stage.name} />
                    {stage.groups.map((g, i) => {
                      const { rows, names: standingNames } = groupData[i]!;
                      return (
                        <div key={g.id} className="flex flex-col gap-(--space-3)">
                          <h3 className="font-semibold text-fg">{g.name}</h3>
                          <FixtureList
                            matches={matches.filter((m) => m.groupId === g.id)}
                            names={names}
                            labels={{ pending: t("tournament.match.pending"), roundLabel: t("tournament.detail.fixture") + " {n}", home: "", away: "", submit: "", saving: "", cascadeWarning: "", cascadeConfirm: "", scheduledAt: "" }}
                          />
                          <StandingsTable rows={rows} names={standingNames} labels={standingsLabels} />
                        </div>
                      );
                    })}
                  </Card>
                );
              }
              if (stage.type === "KNOCKOUT") {
                return (
                  <Card key={stage.id} className="flex flex-col gap-(--space-4)">
                    <CardHeader title={stage.name} />
                    <BracketView matches={matches} names={names} labels={{ bye: t("tournament.bracket.bye"), tbd: t("tournament.bracket.tbd"), thirdPlace: t("tournament.bracket.thirdPlace") }} />
                  </Card>
                );
              }
              const { rows, names: standingNames } = await getStandings(tournament.settings, { stageId: stage.id });
              return (
                <Card key={stage.id} className="flex flex-col gap-(--space-4)">
                  <CardHeader title={stage.name} />
                  <StandingsTable rows={rows} names={standingNames} labels={standingsLabels} />
                  <FixtureList matches={matches} names={names} labels={{ pending: t("tournament.match.pending"), roundLabel: t("tournament.detail.fixture") + " {n}", home: "", away: "", submit: "", saving: "", cascadeWarning: "", cascadeConfirm: "", scheduledAt: "" }} />
                </Card>
              );
            }),
          )}
        </div>
      )}
    </article>
  );
}

export default function PublicTournamentPage(props: PageProps<"/turnuva/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
