// election modülünün public API'si (F11). Bağımlılık yönü approval → election (tek yönlü);
// election approval'ı import etmez — ELECTION_RESULT talebi cron route'ta (app katmanı) oluşturulur.
export { applyCandidacyAction, cancelElectionAction, castVoteAction, createElectionAction, decideCandidacyAction } from "./actions";
export { ElectionBanner } from "./components/election-banner";
export { ElectionCreateDialog } from "./components/election-create-form";
export { tally } from "./domain/state-machine";
export { ELECTION_ERROR_KEYS } from "./errors";
export {
  applyCandidacy,
  cancelElection,
  castVote,
  createElection,
  decideCandidacy,
  finalizeElection,
  markResultPending,
  stageClosedResults,
  syncElectionTimeStatus,
  voidElectionResult,
  type StagedResult,
} from "./service";
export { clubsWithoutActiveElection, eligibleVoterCount, getClubElectionBanner, getElectionResult, listElectionsForAdmin, type ClubElectionBanner } from "./queries";
export { CANDIDACY_STATEMENT_MAX, candidacySchema, castVoteSchema, createElectionSchema } from "./schemas";
