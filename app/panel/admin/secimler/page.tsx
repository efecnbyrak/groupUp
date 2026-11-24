import { Vote } from "lucide-react";
import { Suspense } from "react";

import { personName } from "@/app/_components/requests";
import { confirmLabels } from "@/app/_lib/form-labels";
import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { Badge, Card, ConfirmAction, EmptyState, Skeleton } from "@/components/ui";
import { getT } from "@/i18n/server";
import { formatDateTime } from "@/lib/dates";
import { cancelElectionAction, clubsWithoutActiveElection, createElectionAction, decideCandidacyAction, ElectionCreateDialog, eligibleVoterCount, listElectionsForAdmin } from "@/modules/election";

import { requireAdminPage } from "../admin-context";

export const generateMetadata = titled("admin.nav.elections");

async function Content() {
  const [t, { university }] = await Promise.all([getT(), requireAdminPage()]);
  const [elections, availableClubs] = await Promise.all([listElectionsForAdmin(university.id), clubsWithoutActiveElection(university.id)]);
  const cLabels = confirmLabels(t);

  return (
    <>
      <PageHeader
        title={t("admin.nav.elections")}
        description={t("election.admin.body")}
        action={
          <ElectionCreateDialog
            universityId={university.id}
            clubs={availableClubs}
            action={createElectionAction}
            triggerLabel={t("election.admin.create")}
            dialogTitle={t("election.admin.create")}
            closeLabel={t("common.close")}
            labels={{
              club: t("election.fields.club"),
              title: t("election.fields.title"),
              candidacyOpensAt: t("election.fields.candidacyOpensAt"),
              candidacyClosesAt: t("election.fields.candidacyClosesAt"),
              votingOpensAt: t("election.fields.votingOpensAt"),
              votingClosesAt: t("election.fields.votingClosesAt"),
              submit: t("election.admin.createSubmit"),
              saving: t("common.loading"),
              selectPlaceholder: t("common.select"),
            }}
          />
        }
      />
      {elections.length === 0 ? (
        <EmptyState icon={<Vote aria-hidden="true" className="size-(--icon-size-lg)" />} title={t("election.admin.empty")} description={t("election.admin.emptyBody")} />
      ) : (
        <div className="flex flex-col gap-(--space-4)">
          {await Promise.all(
            elections.map(async (e) => {
              const eligible = e.eligibleSnapshotAt ? await eligibleVoterCount(e.club.id, e.eligibleSnapshotAt) : null;
              const cancellable = ["DRAFT", "CANDIDACY", "VOTING", "CLOSED", "RESULT_PENDING"].includes(e.status);
              const candidateDecidable = e.status === "DRAFT" || e.status === "CANDIDACY";
              return (
                <Card key={e.id} className="flex flex-col gap-(--space-3)">
                  <div className="flex flex-wrap items-center justify-between gap-(--space-2)">
                    <div className="flex flex-col gap-(--space-1)">
                      <h2 className="font-semibold text-fg">
                        {e.club.name} — {e.title}
                      </h2>
                      <p className="text-(length:--type-caption) text-fg-secondary">
                        {formatDateTime(e.candidacyOpensAt, "tr")} → {formatDateTime(e.votingClosesAt, "tr")}
                      </p>
                    </div>
                    <div className="flex items-center gap-(--space-2)">
                      <Badge tone={e.status === "FINALIZED" ? "success" : e.status === "CANCELLED" ? "danger" : "info"}>{t(`election.status.${e.status}`)}</Badge>
                      {cancellable ? (
                        <ConfirmAction
                          action={cancelElectionAction}
                          values={{ universityId: university.id, electionId: e.id }}
                          triggerLabel={t("election.admin.cancelButton")}
                          title={t("election.admin.cancelTitle")}
                          description={t("election.admin.cancelBody")}
                          {...cLabels}
                        />
                      ) : null}
                    </div>
                  </div>
                  {eligible !== null ? <p className="text-(length:--type-body-sm) text-fg-secondary">{t("election.admin.participation", { voted: e._count.ballots, eligible })}</p> : null}
                  <div className="flex flex-col gap-(--space-2)">
                    <h3 className="text-(length:--type-body-sm) font-semibold text-fg">{t("election.admin.candidatesTitle")}</h3>
                    {e.candidates.length === 0 ? (
                      <p className="text-(length:--type-body-sm) text-fg-secondary">{t("election.admin.noCandidates")}</p>
                    ) : (
                      <ul className="flex flex-col gap-(--space-2)">
                        {e.candidates.map((c) => (
                          <li key={c.id} className="flex flex-wrap items-center justify-between gap-(--space-2) rounded-card border border-line p-(--space-3)">
                            <div className="flex flex-col gap-(--space-1)">
                              <span className="font-semibold text-fg">{personName(c.user)}</span>
                              <span className="text-(length:--type-caption) text-fg-secondary">{c.approved ? "" : t("election.admin.pendingCandidate")}</span>
                            </div>
                            {!c.approved && candidateDecidable ? (
                              <div className="flex gap-(--space-2)">
                                <ConfirmAction
                                  action={decideCandidacyAction}
                                  values={{ universityId: university.id, candidateId: c.id, approved: "true" }}
                                  triggerLabel={t("approval.approve")}
                                  title={t("approval.approve")}
                                  description=""
                                  variant="primary"
                                  {...cLabels}
                                />
                                <ConfirmAction
                                  action={decideCandidacyAction}
                                  values={{ universityId: university.id, candidateId: c.id, approved: "false" }}
                                  triggerLabel={t("approval.reject")}
                                  title={t("approval.reject")}
                                  description=""
                                  {...cLabels}
                                />
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Card>
              );
            }),
          )}
        </div>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content />
    </Suspense>
  );
}
