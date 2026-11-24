import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import type { Prisma } from "@/lib/db-types";
import { createEventDraft } from "@/modules/event";
import {
  autoScheduleTournament,
  createTimeSlot,
  createTournament,
  createVenue,
  generateBracket,
  generateNextSwissRound,
  getTournament,
  recordFfaHeatResult,
  recordScore,
  scheduleMatch,
} from "@/modules/tournament";

import { clubFixture, errorCode, resetDatabase } from "./helpers";

type Fixture = Awaited<ReturnType<typeof resetDatabase>>;
let fx: Fixture;

beforeEach(async () => {
  fx = await resetDatabase();
});

async function setupEvent() {
  const fixture = await clubFixture(fx.university.id, { members: 16 });
  const category = await db.eventCategory.create({ data: { slug: `kat-${Date.now()}-${Math.random()}`, nameTr: "Turnuva", nameEn: "Tournament" } });
  const { id: eventId } = await createEventDraft(fixture.president, fixture.club.id, { categoryId: category.id, titleTr: "F9" });
  await db.event.update({
    where: { id: eventId },
    data: { status: "PUBLISHED", summaryTr: "x", locationName: "Salon", startAt: new Date(), endAt: new Date(Date.now() + 14 * 24 * 3600_000), applyOpensAt: new Date(Date.now() - 1000), applyClosesAt: new Date(Date.now() + 3600_000), publishedAt: new Date() },
  });
  return { ...fixture, eventId };
}

async function acceptIndividuals(eventId: string, members: { id: string }[], count: number) {
  for (let i = 0; i < count; i++) {
    await db.registration.create({ data: { eventId, userId: members[i]!.id, status: "ACCEPTED", answers: {}, profileSnapshot: {} } });
  }
}

describe("çift eleme (DOUBLE_ELIM)", () => {
  it("8 kişilik braket üretilir, oynanır, grandFinalReset senaryosu dahil tamamlanır", async () => {
    const { club, president, eventId, members } = await setupEvent();
    await acceptIndividuals(eventId, members, 8);
    const { id } = await createTournament(president, club.id, eventId, { name: "Çift Eleme", format: "DOUBLE_ELIM", source: "INDIVIDUALS", manualNames: [], isPublic: false });
    await createTournamentSettings(id, { doubleElim: { grandFinalReset: true } });
    await generateBracket(president, club.id, id);

    let t = await getTournament(club.id, id);
    expect(t?.status).toBe("SEEDED");
    const matches = await db.match.findMany({ where: { stage: { tournamentId: id } } });
    expect(matches).toHaveLength(2 * 8 - 1); // reset maçı dahil pre-created

    // Tüm WINNERS/LOSERS/FINAL maçlarını home kazanıyor diyerek sırayla oynat (bağımlılık sırasına göre).
    let guard = 0;
    while (guard++ < 50) {
      const playable = await db.match.findMany({ where: { stage: { tournamentId: id }, status: "PENDING", homeId: { not: null }, awayId: { not: null } } });
      if (playable.length === 0) break;
      for (const m of playable) {
        await recordScore(president, club.id, m.id, { homeScore: 1, awayScore: 0 });
      }
    }

    t = await getTournament(club.id, id);
    expect(t?.status).toBe("COMPLETED");
  });
});

async function createTournamentSettings(tournamentId: string, extra: Record<string, unknown>) {
  const t = await db.tournament.findUniqueOrThrow({ where: { id: tournamentId }, select: { settings: true } });
  await db.tournament.update({ where: { id: tournamentId }, data: { settings: { ...(t.settings as object), ...extra } as Prisma.InputJsonValue } });
}

describe("İsviçre sistemi (SWISS)", () => {
  it("önceki tur tamamlanmadan yeni tur üretilemez; tamamlanınca üretilir", async () => {
    const { club, president, eventId, members } = await setupEvent();
    await acceptIndividuals(eventId, members, 8);
    const { id } = await createTournament(president, club.id, eventId, { name: "İsviçre", format: "SWISS", source: "INDIVIDUALS", manualNames: [], isPublic: false });
    await generateBracket(president, club.id, id);

    const stage = await db.stage.findFirstOrThrow({ where: { tournamentId: id, type: "SWISS" } });
    const round1 = await db.match.findMany({ where: { stageId: stage.id, round: 1 } });
    expect(round1).toHaveLength(4);

    expect(await errorCode(generateNextSwissRound(president, club.id, id, stage.id))).toBe("ROUND_NOT_DONE");

    for (const m of round1) {
      if (m.status === "BYE") continue;
      await recordScore(president, club.id, m.id, { homeScore: 1, awayScore: 0 });
    }
    await generateNextSwissRound(president, club.id, id, stage.id);
    const round2 = await db.match.findMany({ where: { stageId: stage.id, round: 2 } });
    expect(round2).toHaveLength(4);
  });
});

describe("FFA / Sıralama", () => {
  it("heat'ler üretilir, roster doğrulanır, puan tablosuyla sonuç kaydedilir", async () => {
    const { club, president, eventId, members } = await setupEvent();
    await acceptIndividuals(eventId, members, 8);
    const { id } = await createTournament(president, club.id, eventId, { name: "FFA", format: "FREE_FOR_ALL", source: "INDIVIDUALS", manualNames: [], isPublic: false });
    await createTournamentSettings(id, { ffa: { heatSize: 4, pointsTable: [10, 8, 6, 5] } });
    await generateBracket(president, club.id, id);

    const heats = await db.match.findMany({ where: { stage: { tournamentId: id } } });
    expect(heats).toHaveLength(2);
    const heat = heats[0]!;
    const roster = heat.ffaResults as { participantId: string }[];
    expect(roster).toHaveLength(4);

    expect(await errorCode(recordFfaHeatResult(president, club.id, heat.id, [{ participantId: roster[0]!.participantId, rank: 1 }]))).toBe("INVALID_SCORE");

    await recordFfaHeatResult(
      president,
      club.id,
      heat.id,
      roster.map((r, i) => ({ participantId: r.participantId, rank: i + 1 })),
    );
    const scored = await db.match.findUniqueOrThrow({ where: { id: heat.id } });
    expect(scored.status).toBe("COMPLETED");
    const results = scored.ffaResults as { points: number }[];
    expect(results.map((r) => r.points).sort((a, b) => b - a)).toEqual([10, 8, 6, 5]);
  });
});

describe("Venue + TimeSlot + planlama", () => {
  it("otomatik planlama maçları saha/zamana yerleştirir; elle yeniden planlamada çakışma uyarısı verir", async () => {
    const { club, president, eventId, members } = await setupEvent();
    await acceptIndividuals(eventId, members, 4);
    const { id } = await createTournament(president, club.id, eventId, { name: "Planlama", format: "SINGLE_ELIM", source: "INDIVIDUALS", manualNames: [], isPublic: false });
    await generateBracket(president, club.id, id);

    const venue = await createVenue(president, club.id, id, "Salon A");
    const weekday = (new Date().getDay() + 6) % 7;
    await createTimeSlot(president, club.id, venue.id, { weekday, startMinute: 0, endMinute: 1440, matchMinutes: 30 });

    const result = await autoScheduleTournament(president, club.id, id);
    expect(result.placed).toBeGreaterThan(0);

    const matches = await db.match.findMany({ where: { stage: { tournamentId: id } }, orderBy: { round: "asc" } });
    const scheduledMatch = matches.find((m) => m.scheduledAt)!;
    expect(scheduledMatch.venueId).toBe(venue.id);

    // Aynı saha+saate ikinci bir maçı elle koymaya çalış → çakışma.
    const other = matches.find((m) => m.id !== scheduledMatch.id && m.homeId && m.awayId && m.round === scheduledMatch.round)!;
    expect(await errorCode(scheduleMatch(president, club.id, other.id, { scheduledAt: scheduledMatch.scheduledAt!, venueId: venue.id }))).toBe("SCHEDULE_CONFLICT");
    await scheduleMatch(president, club.id, other.id, { scheduledAt: scheduledMatch.scheduledAt!, venueId: venue.id, forceConflict: true });
    const forced = await db.match.findUniqueOrThrow({ where: { id: other.id } });
    expect(forced.venueId).toBe(venue.id);
  });
});
