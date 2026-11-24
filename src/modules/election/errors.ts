import type { MessageKey } from "@/i18n/messages";

import type { ElectionErrorCode } from "./service";

export const ELECTION_ERROR_KEYS: Partial<Record<ElectionErrorCode, MessageKey>> = {
  NOT_FOUND: "university.errors.notFound",
  INVALID_DATES: "election.errors.invalidDates",
  ACTIVE_ELECTION_EXISTS: "election.errors.activeExists",
  NOT_CANDIDACY_WINDOW: "election.errors.notCandidacyWindow",
  NOT_VOTING_WINDOW: "election.errors.notVotingWindow",
  NOT_ELIGIBLE: "election.errors.notEligible",
  ALREADY_CANDIDATE: "election.errors.alreadyCandidate",
  CANDIDATE_NOT_APPROVED: "election.errors.candidateNotApproved",
  ALREADY_VOTED: "election.errors.alreadyVoted",
  INVALID_CANDIDATE: "election.errors.invalidCandidate",
};
