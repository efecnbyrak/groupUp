import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { confirmLabels, formLabels } from "@/app/_lib/form-labels";
import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { ActionDialog, Badge, ButtonLink, Card, CardHeader, ConfirmAction, Skeleton, type BadgeTone } from "@/components/ui";
import type { MessageKey } from "@/i18n/messages";
import { getT } from "@/i18n/server";
import {
  addParticipantAction,
  BracketView,
  updateGroupsSettingsAction,
  FixtureList,
  generateBracketAction,
  generateKnockoutStageAction,
  getStageMatches,
  getStandings,
  getTournament,
  recordScoreAction,
  removeParticipantAction,
  renameParticipantAction,
  scheduleMatchAction,
  StandingsTable,
  type TournamentSettings,
} from "@/modules/tournament";

import { requireClubPage } from "../../../../club-context";

export const generateMetadata = titled("tournament.detail.participants");

const STATUS_TONE: Record<string, BadgeTone> = { DRAFT: "neutral", SEEDED: "info", IN_PROGRESS: "warning", COMPLETED: "success", CANCELLED: "danger" };

/** Kulüp paneli turnuva yönetimi: katılımcılar/tohum (DRAFT), braket/fikstür/standings + skor girişi. */
async function Content({ params }: PageProps<"/panel/kulup/[slug]/etkinlikler/[id]/turnuvalar/[tournamentId]">) {
  await connection();
  const [t, { slug, id, tournamentId }] = await Promise.all([getT(), params]);
  const { club } = await requireClubPage(slug, "TOURNAMENT_MANAGE");
  const tournament = await getTournament(club.id, tournamentId);
  if (!tournament) notFound();
  const base = `/panel/kulup/${club.slug}/etkinlikler/${id}/turnuvalar`;
  const labels = formLabels(t);
  const confirm = confirmLabels(t);
  const settings = tournament.settings as unknown as TournamentSettings;
  const names = new Map(tournament.participants.map((p) => [p.id, p.displayName]));

  const scoreLabels = {
    home: t("tournament.match.home"),
    away: t("tournament.match.away"),
    submit: t("tournament.match.submit"),
    saving: t("tournament.match.saving"),
    cascadeWarning: t("tournament.errors.downstreamPlayed"),
    cascadeConfirm: t("tournament.match.cascadeConfirm"),
    scheduledAt: t("tournament.match.scheduledAt"),
  };
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
    <>
      <Link href={base} className="inline-flex items-center gap-(--space-1) text-(length:--type-body-sm) font-semibold text-link hover:underline">
        <ArrowLeft aria-hidden="true" className="size-(--icon-size-sm)" />
        {t("tournament.panel.title")}
      </Link>
      <PageHeader
        title={tournament.name}
        description={t(`tournament.format.${tournament.format}` as MessageKey)}
        action={
          <div className="flex flex-wrap items-center gap-(--space-2)">
            {tournament.isPublic ? (
              <ButtonLink href={`/turnuva/${tournament.id}`} target="_blank" variant="secondary" size="sm" icon={<ExternalLink aria-hidden="true" className="size-(--icon-size-sm)" />}>
                {t("tournament.detail.viewPublic")}
              </ButtonLink>
            ) : null}
            <Badge tone={STATUS_TONE[tournament.status] ?? "neutral"}>{t(`tournament.status.${tournament.status}` as MessageKey)}</Badge>
          </div>
        }
      />

      {tournament.status === "DRAFT" ? (
        <DraftView tournament={tournament} clubId={club.id} t={t} labels={labels} confirm={confirm} settings={settings} />
      ) : (
        <div className="flex flex-col gap-(--space-6)">
          {tournament.stages.map((stage) => (
            <Card key={stage.id} className="flex flex-col gap-(--space-4)">
              <CardHeader title={stage.name} />
              {stage.groups.length > 0 ? (
                <GroupsStage
                  tournamentId={tournament.id}
                  tournamentSettings={tournament.settings}
                  stage={stage}
                  names={names}
                  clubId={club.id}
                  t={t}
                  scoreLabels={scoreLabels}
                  standingsLabels={standingsLabels}
                  confirm={confirm}
                  hasKnockout={tournament.stages.some((s) => s.type === "KNOCKOUT")}
                />
              ) : stage.type === "KNOCKOUT" ? (
                <KnockoutStage stageId={stage.id} names={names} clubId={club.id} t={t} scoreLabels={scoreLabels} />
              ) : (
                <RoundRobinStage tournamentId={tournament.id} stageId={stage.id} settings={tournament.settings} names={names} clubId={club.id} t={t} scoreLabels={scoreLabels} standingsLabels={standingsLabels} />
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

async function KnockoutStage({ stageId, names, clubId, t, scoreLabels }: { stageId: string; names: Map<string, string>; clubId: string; t: Awaited<ReturnType<typeof getT>>; scoreLabels: NonNullable<unknown> }) {
  const matches = await getStageMatches(stageId);
  return (
    <BracketView
      matches={matches}
      names={names}
      labels={{ bye: t("tournament.bracket.bye"), tbd: t("tournament.bracket.tbd"), thirdPlace: t("tournament.bracket.thirdPlace") }}
      canManage
      clubId={clubId}
      recordScoreAction={recordScoreAction}
      scoreLabels={scoreLabels as never}
      scheduleMatchAction={scheduleMatchAction}
      scheduleLabels={scoreLabels as never}
    />
  );
}

async function RoundRobinStage({
  tournamentId: _tournamentId,
  stageId,
  settings,
  names,
  clubId,
  t,
  scoreLabels,
  standingsLabels,
}: {
  tournamentId: string;
  stageId: string;
  settings: unknown;
  names: Map<string, string>;
  clubId: string;
  t: Awaited<ReturnType<typeof getT>>;
  scoreLabels: NonNullable<unknown>;
  standingsLabels: NonNullable<unknown>;
}) {
  const [{ rows, names: standingNames }, matches] = await Promise.all([getStandings(settings, { stageId }), getStageMatches(stageId)]);
  return (
    <div className="flex flex-col gap-(--space-4)">
      <StandingsTable rows={rows} names={standingNames} labels={standingsLabels as never} />
      <FixtureList matches={matches} names={names} canManage clubId={clubId} recordScoreAction={recordScoreAction} scheduleMatchAction={scheduleMatchAction} labels={{ ...(scoreLabels as object), pending: t("tournament.match.pending"), roundLabel: t("tournament.detail.fixture") + " {n}" } as never} />
    </div>
  );
}

async function GroupsStage({
  tournamentSettings,
  stage,
  names,
  clubId,
  t,
  scoreLabels,
  standingsLabels,
  confirm,
  hasKnockout,
  tournamentId,
}: {
  tournamentId: string;
  tournamentSettings: unknown;
  stage: NonNullable<Awaited<ReturnType<typeof getTournament>>>["stages"][number];
  names: Map<string, string>;
  clubId: string;
  t: Awaited<ReturnType<typeof getT>>;
  scoreLabels: NonNullable<unknown>;
  standingsLabels: NonNullable<unknown>;
  confirm: ReturnType<typeof confirmLabels>;
  hasKnockout: boolean;
}) {
  const matches = await getStageMatches(stage.id);
  const stageSettings = stage.settings as { advancePerGroup?: number };
  const groupData = await Promise.all(stage.groups.map((g) => getStandings(tournamentSettings, { groupId: g.id })));
  return (
    <div className="flex flex-col gap-(--space-6)">
      {stage.groups.map((g, i) => {
        const { rows, names: standingNames } = groupData[i]!;
        const groupMatches = matches.filter((m) => m.groupId === g.id);
        return (
          <div key={g.id} className="flex flex-col gap-(--space-3)">
            <h3 className="font-semibold text-fg">{g.name}</h3>
            <StandingsTable rows={rows} names={standingNames} labels={standingsLabels as never} highlightTop={stageSettings.advancePerGroup} />
            <FixtureList matches={groupMatches} names={names} canManage clubId={clubId} recordScoreAction={recordScoreAction} scheduleMatchAction={scheduleMatchAction} labels={{ ...(scoreLabels as object), pending: t("tournament.match.pending"), roundLabel: t("tournament.detail.fixture") + " {n}" } as never} />
          </div>
        );
      })}
      <KnockoutTrigger tournamentId={tournamentId} clubId={clubId} stageId={stage.id} hasKnockout={hasKnockout} t={t} confirm={confirm} />
    </div>
  );
}

function KnockoutTrigger({ tournamentId, clubId, stageId, hasKnockout, t, confirm }: { tournamentId: string; clubId: string; stageId: string; hasKnockout: boolean; t: Awaited<ReturnType<typeof getT>>; confirm: ReturnType<typeof confirmLabels> }) {
  if (hasKnockout) return null;
  return (
    <ConfirmAction
      action={generateKnockoutStageAction}
      values={{ clubId, tournamentId, stageId }}
      variant="primary"
      triggerLabel={t("tournament.detail.generateKnockout")}
      title={t("tournament.detail.generateKnockoutTitle")}
      description={t("tournament.detail.generateKnockoutBody")}
      {...confirm}
    />
  );
}

function DraftView({
  tournament,
  clubId,
  t,
  labels,
  confirm,
  settings,
}: {
  tournament: NonNullable<Awaited<ReturnType<typeof getTournament>>>;
  clubId: string;
  t: Awaited<ReturnType<typeof getT>>;
  labels: ReturnType<typeof formLabels>;
  confirm: ReturnType<typeof confirmLabels>;
  settings: TournamentSettings;
}) {
  const needsGroups = tournament.format === "GROUPS_KNOCKOUT" && !settings.groups;
  return (
    <div className="flex flex-col gap-(--space-6)">
      {tournament.format === "GROUPS_KNOCKOUT" ? (
        <Card className="flex flex-col gap-(--space-3)">
          <CardHeader
            title={t("tournament.groups.title")}
            description={settings.groups ? `${t("tournament.groups.count")}: ${settings.groups.count} · ${t("tournament.groups.advancePerGroup")}: ${settings.groups.advancePerGroup}` : t("tournament.groups.body")}
            action={
              <ActionDialog
                triggerLabel={t("tournament.groups.save")}
                triggerVariant={settings.groups ? "secondary" : "primary"}
                title={t("tournament.groups.title")}
                description={t("tournament.groups.body")}
                action={updateGroupsSettingsAction}
                fields={[
                  { type: "hidden", name: "clubId", value: clubId },
                  { type: "hidden", name: "tournamentId", value: tournament.id },
                  { type: "number", name: "groupCount", label: t("tournament.groups.count"), required: true, min: 2, max: 16, defaultValue: String(settings.groups?.count ?? 4) },
                  { type: "number", name: "advancePerGroup", label: t("tournament.groups.advancePerGroup"), required: true, min: 1, max: 8, defaultValue: String(settings.groups?.advancePerGroup ?? 2) },
                  { type: "number", name: "bestThirds", label: t("tournament.groups.bestThirds"), min: 0, max: 8, defaultValue: String(settings.groups?.bestThirds ?? 0) },
                ]}
                submitLabel={t("tournament.groups.save")}
                {...labels}
              />
            }
          />
        </Card>
      ) : null}
      <Card className="flex flex-col gap-(--space-3)">
        <CardHeader
          title={t("tournament.detail.participants")}
          description={t("tournament.detail.participantsBody")}
          action={
            <ActionDialog
              triggerLabel={t("tournament.detail.addParticipant")}
              triggerVariant="secondary"
              title={t("tournament.detail.addParticipantTitle")}
              action={addParticipantAction}
              fields={[
                { type: "hidden", name: "clubId", value: clubId },
                { type: "hidden", name: "tournamentId", value: tournament.id },
                { type: "text", name: "displayName", label: t("tournament.detail.nameField"), required: true, maxLength: 80 },
                { type: "number", name: "seed", label: t("tournament.detail.seedField") },
              ]}
              submitLabel={t("tournament.detail.addParticipant")}
              {...labels}
            />
          }
        />
        <ul className="flex flex-col gap-(--space-2)">
          {tournament.participants.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-(--space-3) rounded-control border border-line px-(--space-3) py-(--space-2)">
              <span className="flex items-center gap-(--space-2)">
                <Badge tone="neutral">{p.seed ?? "—"}</Badge>
                <span className="font-medium text-fg">{p.displayName}</span>
              </span>
              <span className="flex gap-(--space-2)">
                <ActionDialog
                  triggerLabel={t("tournament.detail.rename")}
                  triggerSize="sm"
                  title={t("tournament.detail.renameTitle")}
                  action={renameParticipantAction}
                  fields={[
                    { type: "hidden", name: "participantId", value: p.id },
                    { type: "text", name: "displayName", label: t("tournament.detail.nameField"), required: true, maxLength: 80, defaultValue: p.displayName },
                  ]}
                  submitLabel={t("common.save")}
                  {...labels}
                />
                <ConfirmAction
                  action={removeParticipantAction}
                  values={{ clubId, tournamentId: tournament.id, participantId: p.id }}
                  triggerLabel={t("common.remove")}
                  title={t("tournament.detail.removeParticipantTitle")}
                  {...confirm}
                />
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <div>
        <ConfirmAction
          action={generateBracketAction}
          values={{ clubId, tournamentId: tournament.id }}
          variant="primary"
          triggerLabel={t("tournament.detail.generateBracket")}
          title={t("tournament.detail.generateBracketTitle")}
          description={t("tournament.detail.generateBracketBody")}
          {...confirm}
        />
        {needsGroups ? <p className="mt-(--space-2) text-(length:--type-caption) text-negative">{t("tournament.groups.title")}</p> : null}
      </div>
    </div>
  );
}

export default function TournamentDetailPage(props: PageProps<"/panel/kulup/[slug]/etkinlikler/[id]/turnuvalar/[tournamentId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
