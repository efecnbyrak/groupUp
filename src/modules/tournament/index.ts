// tournament modülünün public API'si (ARCHITECTURE §4: registration, event'e bağımlı; onlar
// bu modülü import ETMEZ — tek yönlü bağımlılık).
export {
  addParticipantAction,
  autoScheduleAction,
  createTimeSlotAction,
  createTournamentAction,
  createVenueAction,
  generateBracketAction,
  generateKnockoutStageAction,
  generateNextSwissRoundAction,
  postponeMatchAction,
  recordFfaResultAction,
  recordScoreAction,
  recordWalkoverAction,
  removeParticipantAction,
  removeTimeSlotAction,
  removeVenueAction,
  renameParticipantAction,
  scheduleMatchAction,
  updateGroupsSettingsAction,
  updateSeedsAction,
  updateSettingsAction,
} from "./actions";
export { generateDoubleElimination, type DoubleEliminationOptions } from "./domain/double-elimination";
export { computeFfaStandings, generateFfaHeats, scoreFfaHeat, type FfaHeatResult, type FfaPointsTable } from "./domain/ffa";
export { generateRoundRobin, type RoundRobinOptions } from "./domain/round-robin";
export { expandSlotTemplates, scheduleGreedy, type ScheduleConstraints, type ScheduleResult, type SchedulableMatch, type SlotInstance, type VenueSlotTemplate } from "./domain/scheduling";
export { generateSingleElimination, nextPowerOfTwo, seedPositions, type SingleEliminationOptions } from "./domain/single-elimination";
export {
  computeBuchholz,
  computeSonnebornBerger,
  computeStandings,
  computeSwissStandings,
  rankStandings,
  type StandingRow,
  type StandingsMatch,
  type SwissOutcome,
  type Tiebreaker,
} from "./domain/standings";
export { defaultSwissRounds, generateSwissRound, type SwissPlayerState } from "./domain/swiss";
export type { BracketSidePlan, DomainParticipant, MatchPlan, PlannedMatch } from "./domain/types";
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
export { autoScheduleTournament, type AutoScheduleResult } from "./scheduling";
export { fail as tournamentError } from "./service";
export {
  addParticipant,
  createTimeSlot,
  createTournament,
  createVenue,
  generateBracket,
  generateKnockoutStage,
  generateNextSwissRound,
  removeParticipant,
  removeTimeSlot,
  removeVenue,
  renameParticipant,
  updateGroupsSettings,
  updateSeeds,
  updateSettings,
  type CreateTimeSlotInput,
  type CreateTournamentInput,
} from "./tournaments";
export { postponeMatch, recordFfaHeatResult, recordScore, recordWalkover, scheduleMatch, type FfaResultInputItem, type ScheduleInput, type ScoreInput } from "./matches";
export { BracketView, type BracketLabels } from "./components/bracket-view";
export { FixtureList, type FixtureListLabels } from "./components/fixture-list";
export { StandingsTable, type StandingsTableLabels } from "./components/standings-table";
export { ScheduleMatchForm, ScoreForm, type ScheduleFormLabels, type ScoreFormLabels } from "./components/score-form";
