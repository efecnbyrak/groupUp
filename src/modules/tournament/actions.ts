"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { runAction } from "@/i18n/action-result";
import { requireClubPermission } from "@/lib/authz";
import type { ActionResult } from "@/lib/errors";
import { enforceRateLimits } from "@/lib/rate-limit";

import { fromIstanbulLocalInput } from "@/lib/dates";

import {
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
} from "./tournaments";
import { postponeMatch, recordFfaHeatResult, recordScore, recordWalkover, scheduleMatch } from "./matches";
import { autoScheduleTournament } from "./scheduling";
import { TOURNAMENT_ERROR_KEYS as errors } from "./errors";
import {
  addParticipantSchema,
  autoScheduleSchema,
  createTournamentSchema,
  generateBracketSchema,
  generateKnockoutSchema,
  generateSwissRoundSchema,
  groupsSchema,
  participantNameSchema,
  postponeSchema,
  recordFfaResultSchema,
  recordScoreSchema,
  removeParticipantSchema,
  scheduleSchema,
  seedSchema,
  timeSlotIdSchema,
  timeSlotSchema,
  updateSettingsSchema,
  venueIdSchema,
  venueSchema,
  walkoverSchema,
} from "./schemas";

type Prev = ActionResult | null;
const clubIdOf = (fd: FormData) => String(fd.get("clubId") ?? "");
const manage = (clubId: string) => () => requireClubPermission(clubId, "TOURNAMENT_MANAGE", { allowAdmin: false });
const refresh = (eventId?: string) => {
  revalidatePath("/panel/kulup", "layout");
  if (eventId) revalidatePath(`/turnuva`, "layout");
};

export async function createTournamentAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  let target: string | null = null;
  const result = await runAction(formData, {
    authorize: manage(clubId),
    schema: createTournamentSchema,
    errors,
    run: async (user, data) => {
      await enforceRateLimits([{ key: `tournament:create:${user.id}`, limit: 20, windowSec: 3600 }]);
      const { id } = await createTournament(user, clubId, data.eventId, data);
      refresh(data.eventId);
      target = id;
    },
  });
  if (target) redirect(`${String(formData.get("returnTo") ?? "")}/${target}`);
  return result;
}

export async function updateSettingsAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manage(clubId),
    schema: updateSettingsSchema,
    errors,
    run: async (user, data, t) => {
      await updateSettings(user, clubId, data.tournamentId, data.settings);
      refresh();
      return { ok: true, message: t("tournament.settings.saved") };
    },
  });
}

export async function updateGroupsSettingsAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manage(clubId),
    schema: groupsSchema,
    errors,
    run: async (user, data, t) => {
      await updateGroupsSettings(user, clubId, data.tournamentId, data);
      refresh();
      return { ok: true, message: t("tournament.groups.saved") };
    },
  });
}

export async function updateSeedsAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manage(clubId),
    schema: seedSchema,
    errors,
    run: async (user, data, t) => {
      await updateSeeds(user, clubId, data.tournamentId, data.seeds);
      refresh();
      return { ok: true, message: t("tournament.seed.saved") };
    },
  });
}

export async function addParticipantAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manage(clubId),
    schema: addParticipantSchema,
    errors,
    run: async (user, data, t) => {
      await addParticipant(user, clubId, data.tournamentId, data.displayName, data.seed);
      refresh();
      return { ok: true, message: t("tournament.participants.added") };
    },
  });
}

export async function renameParticipantAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manage(clubId),
    schema: participantNameSchema,
    errors,
    run: async (user, data) => {
      await renameParticipant(user, clubId, data.participantId, data.displayName);
      refresh();
    },
  });
}

export async function removeParticipantAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manage(clubId),
    schema: removeParticipantSchema,
    errors,
    run: async (user, data) => {
      await removeParticipant(user, clubId, data.tournamentId, data.participantId);
      refresh();
    },
  });
}

export async function generateBracketAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manage(clubId),
    schema: generateBracketSchema,
    errors,
    run: async (user, data, t) => {
      await generateBracket(user, clubId, data.tournamentId);
      refresh();
      return { ok: true, message: t("tournament.bracket.generated") };
    },
  });
}

export async function generateKnockoutStageAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manage(clubId),
    schema: generateKnockoutSchema,
    errors,
    run: async (user, data, t) => {
      await generateKnockoutStage(user, clubId, data.tournamentId, data.stageId);
      refresh();
      return { ok: true, message: t("tournament.bracket.knockoutGenerated") };
    },
  });
}

export async function recordScoreAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manage(clubId),
    schema: recordScoreSchema,
    errors,
    run: async (user, data, t) => {
      await recordScore(user, clubId, data.matchId, data);
      refresh();
      return { ok: true, message: t("tournament.match.scoreSaved") };
    },
  });
}

export async function recordWalkoverAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manage(clubId),
    schema: walkoverSchema,
    errors,
    run: async (user, data, t) => {
      await recordWalkover(user, clubId, data.matchId, data.winner, data.reason);
      refresh();
      return { ok: true, message: t("tournament.match.scoreSaved") };
    },
  });
}

export async function postponeMatchAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manage(clubId),
    schema: postponeSchema,
    errors,
    run: async (user, data, t) => {
      await postponeMatch(user, clubId, data.matchId, data.note);
      refresh();
      return { ok: true, message: t("tournament.match.postponed") };
    },
  });
}

export async function scheduleMatchAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manage(clubId),
    schema: scheduleSchema,
    errors,
    run: async (user, data, t) => {
      const parsed = fromIstanbulLocalInput(data.scheduledAt);
      if (!parsed) return { ok: false, error: t("errors.invalidForm"), fieldErrors: { scheduledAt: t("validation.required") } };
      await scheduleMatch(user, clubId, data.matchId, { scheduledAt: parsed, venueId: data.venueId, forceConflict: data.forceConflict });
      refresh();
      return { ok: true, message: t("tournament.match.scheduled") };
    },
  });
}

export async function generateNextSwissRoundAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manage(clubId),
    schema: generateSwissRoundSchema,
    errors,
    run: async (user, data, t) => {
      await generateNextSwissRound(user, clubId, data.tournamentId, data.stageId);
      refresh();
      return { ok: true, message: t("tournament.bracket.generated") };
    },
  });
}

export async function recordFfaResultAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manage(clubId),
    schema: recordFfaResultSchema,
    errors,
    run: async (user, data, t) => {
      await recordFfaHeatResult(user, clubId, data.matchId, data.results);
      refresh();
      return { ok: true, message: t("tournament.match.scoreSaved") };
    },
  });
}

export async function createVenueAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manage(clubId),
    schema: venueSchema,
    errors,
    run: async (user, data, t) => {
      await createVenue(user, clubId, data.tournamentId, data.name);
      refresh();
      return { ok: true, message: t("tournament.venue.saved") };
    },
  });
}

export async function removeVenueAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manage(clubId),
    schema: venueIdSchema,
    errors,
    run: async (user, data) => {
      await removeVenue(user, clubId, data.venueId);
      refresh();
    },
  });
}

export async function createTimeSlotAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manage(clubId),
    schema: timeSlotSchema,
    errors,
    run: async (user, data, t) => {
      await createTimeSlot(user, clubId, data.venueId, data);
      refresh();
      return { ok: true, message: t("tournament.venue.saved") };
    },
  });
}

export async function removeTimeSlotAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manage(clubId),
    schema: timeSlotIdSchema,
    errors,
    run: async (user, data) => {
      await removeTimeSlot(user, clubId, data.timeSlotId);
      refresh();
    },
  });
}

export async function autoScheduleAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manage(clubId),
    schema: autoScheduleSchema,
    errors,
    run: async (user, data, t) => {
      const result = await autoScheduleTournament(user, clubId, data.tournamentId);
      refresh();
      return { ok: true, message: t("tournament.schedule.autoScheduled", { placed: result.placed, unplaced: result.unplaced.length }) };
    },
  });
}
