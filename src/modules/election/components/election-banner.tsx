import { ActionForm, Alert, Card, ConfirmAction } from "@/components/ui";
import type { Translate } from "@/i18n/messages";

import { applyCandidacyAction, castVoteAction } from "../actions";
import type { ClubElectionBanner } from "../queries";
import type { getElectionResult } from "../queries";

type Result = Awaited<ReturnType<typeof getElectionResult>>;

/** Kulüp sayfası seçim bandı (ELECTIONS §3) — adaylık/oy pencereleri açıksa, sonuçlanınca özet. */
export function ElectionBanner({ clubId, election, result, t }: { clubId: string; election: NonNullable<ClubElectionBanner>; result: Result; t: Translate }) {
  const confirmButtonLabels = { closeLabel: t("common.close"), loadingLabel: t("common.loading"), cancelLabel: t("common.cancel"), confirmLabel: t("common.confirm") };

  if (election.status === "CANDIDACY" && election.candidacyOpen) {
    return (
      <Card className="flex flex-col gap-(--space-3)">
        <h2 className="font-semibold text-fg">{t("election.banner.candidacyTitle")}</h2>
        {election.viewerIsCandidate ? (
          <p className="text-(length:--type-body-sm) text-fg-secondary">{t("election.banner.alreadyCandidate")}</p>
        ) : (
          <>
            <p className="text-(length:--type-body-sm) text-fg-secondary">{t("election.banner.candidacyBody", { title: election.title })}</p>
            <ActionForm
              action={applyCandidacyAction}
              fields={[
                { type: "hidden", name: "clubId", value: clubId },
                { type: "hidden", name: "electionId", value: election.id },
                { type: "textarea", name: "statementTr", label: t("election.banner.statementLabel"), hint: t("election.banner.statementHint"), required: true, rows: 4, maxLength: 2000 },
              ]}
              submitLabel={t("election.banner.applyButton")}
              loadingLabel={t("common.loading")}
            />
          </>
        )}
      </Card>
    );
  }

  if (election.status === "VOTING" && election.votingOpen) {
    return (
      <Card className="flex flex-col gap-(--space-3)">
        <h2 className="font-semibold text-fg">{t("election.banner.votingTitle")}</h2>
        {election.viewerHasVoted ? (
          <p className="text-(length:--type-body-sm) text-fg-secondary">{t("election.banner.alreadyVoted")}</p>
        ) : (
          <>
            <p className="text-(length:--type-body-sm) text-fg-secondary">{t("election.banner.votingBody", { title: election.title })}</p>
            <ul className="flex flex-col gap-(--space-2)">
              {election.candidates.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-(--space-2) rounded-card border border-line p-(--space-3)">
                  <span className="font-semibold text-fg">{c.user.profile ? `${c.user.profile.firstName} ${c.user.profile.lastName}` : ""}</span>
                  <ConfirmAction
                    action={castVoteAction}
                    values={{ clubId, electionId: election.id, candidateId: c.id }}
                    triggerLabel={election.candidates.length === 1 ? t("election.banner.yesOption") : t("election.banner.voteButton")}
                    title={t("election.banner.voteConfirmTitle")}
                    description={t("election.banner.voteConfirmBody")}
                    variant="primary"
                    {...confirmButtonLabels}
                  />
                </li>
              ))}
              {election.candidates.length === 1 ? (
                <li className="flex items-center justify-between gap-(--space-2) rounded-card border border-line p-(--space-3)">
                  <span className="font-semibold text-fg">{t("election.banner.noOption")}</span>
                  <ConfirmAction
                    action={castVoteAction}
                    values={{ clubId, electionId: election.id, candidateId: "NO" }}
                    triggerLabel={t("election.banner.noOption")}
                    title={t("election.banner.voteConfirmTitle")}
                    description={t("election.banner.voteConfirmBody")}
                    {...confirmButtonLabels}
                  />
                </li>
              ) : null}
            </ul>
          </>
        )}
      </Card>
    );
  }

  if (election.status === "FINALIZED" && result) {
    return (
      <Card className="flex flex-col gap-(--space-3)">
        <h2 className="font-semibold text-fg">{t("election.banner.resultTitle")}</h2>
        {result.election.winnerUserId ? (
          <Alert tone="success">{t("election.banner.resultWinner", { name: result.rows.find((r) => r.userId === result.election.winnerUserId)?.name ?? "" })}</Alert>
        ) : (
          <Alert tone="warning">{t("election.banner.resultTie")}</Alert>
        )}
        <ul className="flex flex-col gap-(--space-1) text-(length:--type-body-sm) text-fg-secondary">
          {result.rows.map((r) => (
            <li key={r.candidateId}>
              {r.name}: {t("election.result.votes", { count: r.votes, pct: r.pct })}
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  return null;
}
