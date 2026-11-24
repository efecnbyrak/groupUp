"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/i18n/action-result";
import { requireClubMember, requireUniversityAdmin } from "@/lib/authz";
import type { ActionResult } from "@/lib/errors";

import { ELECTION_ERROR_KEYS as errors } from "./errors";
import { candidacySchema, castVoteSchema, createElectionSchema, emptySchema } from "./schemas";
import { applyCandidacy, cancelElection, castVote, createElection, decideCandidacy } from "./service";

type Prev = ActionResult | null;
const refreshAll = () => revalidatePath("/", "layout");

export async function createElectionAction(_prev: Prev, formData: FormData) {
  const universityId = String(formData.get("universityId") ?? "");
  return runAction(formData, {
    authorize: () => requireUniversityAdmin(universityId),
    schema: createElectionSchema,
    errors,
    run: async (user, data, t) => {
      await createElection(user, universityId, data);
      refreshAll();
      return { ok: true, message: t("election.admin.created") };
    },
  });
}

export async function cancelElectionAction(_prev: Prev, formData: FormData) {
  const universityId = String(formData.get("universityId") ?? "");
  const electionId = String(formData.get("electionId") ?? "");
  return runAction(formData, {
    authorize: () => requireUniversityAdmin(universityId),
    schema: emptySchema,
    errors,
    run: async (_user, _data, t) => {
      await cancelElection(universityId, electionId);
      refreshAll();
      return { ok: true, message: t("election.admin.cancelled") };
    },
  });
}

export async function decideCandidacyAction(_prev: Prev, formData: FormData) {
  const universityId = String(formData.get("universityId") ?? "");
  const candidateId = String(formData.get("candidateId") ?? "");
  const approved = formData.get("approved") === "true";
  return runAction(formData, {
    authorize: () => requireUniversityAdmin(universityId),
    schema: emptySchema,
    errors,
    run: async (_user, _data, t) => {
      await decideCandidacy(universityId, candidateId, approved);
      refreshAll();
      return { ok: true, message: approved ? t("election.admin.candidateApproved") : t("election.admin.candidateRejected") };
    },
  });
}

export async function applyCandidacyAction(_prev: Prev, formData: FormData) {
  const clubId = String(formData.get("clubId") ?? "");
  return runAction(formData, {
    authorize: () => requireClubMember(clubId),
    schema: candidacySchema,
    errors,
    run: async (user, data, t) => {
      await applyCandidacy(user, data.electionId, data.statementTr);
      refreshAll();
      return { ok: true, message: t("election.member.candidacySubmitted") };
    },
  });
}

export async function castVoteAction(_prev: Prev, formData: FormData) {
  const clubId = String(formData.get("clubId") ?? "");
  return runAction(formData, {
    authorize: () => requireClubMember(clubId),
    schema: castVoteSchema,
    errors,
    run: async (user, data, t) => {
      await castVote(user, data.electionId, data.candidateId);
      refreshAll();
      return { ok: true, message: t("election.member.voteCast") };
    },
  });
}
