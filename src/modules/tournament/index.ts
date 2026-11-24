// tournament modülünün public API'si (ARCHITECTURE §4: registration, event'e bağımlı; onlar
// bu modülü import ETMEZ — tek yönlü bağımlılık).
export {
  addParticipantAction,
  createTournamentAction,
  generateBracketAction,
  generateKnockoutStageAction,
  postponeMatchAction,
  recordScoreAction,
  recordWalkoverAction,
  removeParticipantAction,
  renameParticipantAction,
  updateGroupsSettingsAction,
  updateSeedsAction,
  updateSettingsAction,
} from "./actions";
export { generateRoundRobin, type RoundRobinOptions } from "./domain/round-robin";
export { generateSingleElimination, nextPowerOfTwo, seedPositions, type SingleEliminationOptions } from "./domain/single-elimination";
export { computeStandings, rankStandings, type StandingRow, type StandingsMatch, type Tiebreaker } from "./domain/standings";
export type { DomainParticipant, MatchPlan, PlannedMatch } from "./domain/types";
export { TOURNAMENT_ERROR_KEYS } from "./errors";
export {
  getMyMatches,
  getPublicTournament,
  getStageMatches,
  getStandings,
  getTournament,
  listTournamentsForEvent,
  type MatchView,
} from "./queries";
export { DEFAULT_SETTINGS, PARTICIPANT_SOURCES, TIEBREAKERS, TOURNAMENT_FORMATS, type TournamentSettings } from "./schemas";
export { fail as tournamentError } from "./service";
export {
  addParticipant,
  createTournament,
  generateBracket,
  generateKnockoutStage,
  removeParticipant,
  renameParticipant,
  updateGroupsSettings,
  updateSeeds,
  updateSettings,
  type CreateTournamentInput,
} from "./tournaments";
export { postponeMatch, recordScore, recordWalkover, type ScoreInput } from "./matches";
export { BracketView, type BracketLabels } from "./components/bracket-view";
export { FixtureList, type FixtureListLabels } from "./components/fixture-list";
export { StandingsTable, type StandingsTableLabels } from "./components/standings-table";
export { ScoreForm, type ScoreFormLabels } from "./components/score-form";
