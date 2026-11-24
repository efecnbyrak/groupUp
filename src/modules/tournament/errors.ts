import type { MessageKey } from "@/i18n/messages";

import type { TournamentErrorCode } from "./service";

export const TOURNAMENT_ERROR_KEYS: Partial<Record<TournamentErrorCode, MessageKey>> = {
  NOT_FOUND: "university.errors.notFound",
  NOT_EDITABLE: "tournament.errors.notEditable",
  NO_PARTICIPANTS: "tournament.errors.noParticipants",
  TOO_FEW_PARTICIPANTS: "tournament.errors.tooFewParticipants",
  ALREADY_SEEDED: "tournament.errors.alreadySeeded",
  NOT_SEEDED: "tournament.errors.notSeeded",
  GROUPS_NOT_DONE: "tournament.errors.groupsNotDone",
  STAGE_EXISTS: "tournament.errors.stageExists",
  MATCH_NOT_FOUND: "university.errors.notFound",
  MATCH_NOT_EDITABLE: "tournament.errors.matchNotEditable",
  DOWNSTREAM_PLAYED: "tournament.errors.downstreamPlayed",
  INVALID_SCORE: "tournament.errors.invalidScore",
  DUPLICATE_NAME: "tournament.errors.duplicateName",
};
