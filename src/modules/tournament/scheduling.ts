import "server-only";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";

import { expandSlotTemplates, scheduleGreedy, type SchedulableMatch } from "./domain/scheduling";
import { fail } from "./service";

interface Actor {
  id: string;
}

export interface AutoScheduleResult {
  placed: number;
  unplaced: { matchId: string; round: number }[];
}

/**
 * Venue+TimeSlot şablonlarından somut slotlar türetir, zamanlanmamış maçları bağımlılık
 * sırasına göre açgözlü yerleştirir (TOURNAMENTS §5). `Event.startAt`/`endAt` slot genişletmenin
 * sınırıdır; tanımsızsa bugünden 60 gün ileriye kadar varsayılır.
 */
export async function autoScheduleTournament(actor: Actor, clubId: string, tournamentId: string): Promise<AutoScheduleResult> {
  const t = await db.tournament.findFirst({
    where: { id: tournamentId, event: { clubId } },
    select: { id: true, event: { select: { universityId: true, startAt: true, endAt: true } } },
  });
  if (!t) throw fail("NOT_FOUND");

  const venues = await db.venue.findMany({ where: { tournamentId }, select: { id: true, slots: { select: { weekday: true, startMinute: true, endMinute: true, matchMinutes: true } } } });
  const templates = venues.flatMap((v) => v.slots.map((s) => ({ venueId: v.id, ...s })));

  const from = t.event.startAt ?? new Date();
  const to = t.event.endAt ?? new Date(from.getTime() + 60 * 24 * 60 * 60_000);
  const slots = expandSlotTemplates(templates, from, to);

  const matches = await db.match.findMany({
    where: { stage: { tournamentId }, scheduledAt: null, status: "PENDING", homeId: { not: null }, awayId: { not: null } },
    select: { id: true, round: true, homeId: true, awayId: true, nextMatchId: true, loserMatchId: true },
  });

  const dependsOn = new Map<string, string[]>();
  for (const m of matches) {
    if (m.nextMatchId) dependsOn.set(m.nextMatchId, [...(dependsOn.get(m.nextMatchId) ?? []), m.id]);
    if (m.loserMatchId) dependsOn.set(m.loserMatchId, [...(dependsOn.get(m.loserMatchId) ?? []), m.id]);
  }

  const schedulable: SchedulableMatch[] = matches.map((m) => ({
    id: m.id,
    round: m.round,
    dependsOn: dependsOn.get(m.id) ?? [],
    participantIds: [m.homeId!, m.awayId!],
  }));

  const result = scheduleGreedy(schedulable, slots, [], { minRestMin: 30, maxMatchesPerDay: 6 });

  await db.$transaction(async (tx) => {
    for (const p of result.placed) {
      await tx.match.update({ where: { id: p.matchId }, data: { scheduledAt: p.start, venueId: p.venueId } });
    }
    await audit({ action: "tournament.autoScheduled", targetType: "Tournament", targetId: tournamentId, actorId: actor.id, universityId: t.event.universityId, meta: { placed: result.placed.length, unplaced: result.unplaced.length } }, tx);
  });

  const unplaced = result.unplaced.map((matchId) => ({ matchId, round: matches.find((m) => m.id === matchId)!.round }));
  return { placed: result.placed.length, unplaced };
}
