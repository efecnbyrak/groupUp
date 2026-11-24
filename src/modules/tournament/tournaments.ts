import "server-only";

import { audit } from "@/lib/audit";
import { db, type Tx } from "@/lib/db";
import type { Prisma } from "@/lib/db-types";

import { generateDoubleElimination } from "./domain/double-elimination";
import { generateFfaHeats } from "./domain/ffa";
import { assignGroups, seedKnockoutFromGroups } from "./domain/groups-knockout";
import { generateRoundRobin } from "./domain/round-robin";
import { generateSingleElimination } from "./domain/single-elimination";
import { computeStandings, rankStandings } from "./domain/standings";
import { defaultSwissRounds, generateSwissRound, type SwissPlayerState } from "./domain/swiss";
import type { DomainParticipant } from "./domain/types";
import { DEFAULT_SETTINGS, type TournamentSettings } from "./schemas";
import { fail } from "./service";

interface Actor {
  id: string;
}

export interface CreateTournamentInput {
  name: string;
  format: "SINGLE_ELIM" | "DOUBLE_ELIM" | "ROUND_ROBIN" | "GROUPS_KNOCKOUT" | "SWISS" | "FREE_FOR_ALL";
  source: "TEAMS" | "INDIVIDUALS" | "MANUAL";
  manualNames: string[];
  isPublic: boolean;
}

async function loadEventInClub(client: Tx | typeof db, clubId: string, eventId: string) {
  const e = await client.event.findFirst({ where: { id: eventId, clubId, club: { deletedAt: null } }, select: { id: true, universityId: true, mode: true } });
  if (!e) throw fail("NOT_FOUND");
  return e;
}

/** Turnuva oluştur: kaynak kabul edilmiş takımlar / bireyler / elle liste (TOURNAMENTS §7). */
export async function createTournament(actor: Actor, clubId: string, eventId: string, input: CreateTournamentInput): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const event = await loadEventInClub(tx, clubId, eventId);
    const tournament = await tx.tournament.create({
      data: {
        eventId,
        name: input.name,
        format: input.format,
        settings: DEFAULT_SETTINGS as unknown as Prisma.InputJsonValue,
        isPublic: input.isPublic,
        createdById: actor.id,
      },
      select: { id: true },
    });

    let participants: { displayName: string; teamId?: string; userId?: string }[] = [];
    if (input.source === "TEAMS") {
      const teams = await tx.team.findMany({ where: { eventId, status: "ACCEPTED" }, select: { id: true, name: true } });
      if (teams.length === 0) throw fail("NO_PARTICIPANTS");
      participants = teams.map((t) => ({ displayName: t.name, teamId: t.id }));
    } else if (input.source === "INDIVIDUALS") {
      const regs = await tx.registration.findMany({
        where: { eventId, status: "ACCEPTED", teamId: null },
        select: { userId: true, user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } } },
      });
      if (regs.length === 0) throw fail("NO_PARTICIPANTS");
      participants = regs.map((r) => ({ displayName: [r.user.profile?.firstName, r.user.profile?.lastName].filter(Boolean).join(" ") || r.user.email, userId: r.userId }));
    } else {
      if (input.manualNames.length === 0) throw fail("NO_PARTICIPANTS");
      participants = input.manualNames.map((n) => ({ displayName: n }));
    }

    await tx.participant.createMany({
      data: participants.map((p, i) => ({ tournamentId: tournament.id, displayName: p.displayName, teamId: p.teamId, userId: p.userId, seed: i + 1 })),
    });
    await audit({ action: "tournament.created", targetType: "Tournament", targetId: tournament.id, actorId: actor.id, universityId: event.universityId, meta: { eventId, format: input.format, count: participants.length } }, tx);
    return tournament;
  });
}

async function loadTournamentInClub(client: Tx | typeof db, clubId: string, tournamentId: string) {
  const t = await client.tournament.findFirst({
    where: { id: tournamentId, event: { clubId } },
    select: { id: true, eventId: true, format: true, status: true, settings: true, event: { select: { universityId: true } } },
  });
  if (!t) throw fail("NOT_FOUND");
  return t;
}

export async function updateSettings(actor: Actor, clubId: string, tournamentId: string, settings: TournamentSettings): Promise<void> {
  await db.$transaction(async (tx) => {
    const t = await loadTournamentInClub(tx, clubId, tournamentId);
    if (t.status !== "DRAFT" && t.status !== "SEEDED") throw fail("NOT_EDITABLE");
    await tx.tournament.update({ where: { id: tournamentId }, data: { settings: settings as unknown as Prisma.InputJsonValue } });
    await audit({ action: "tournament.settingsUpdated", targetType: "Tournament", targetId: tournamentId, actorId: actor.id, universityId: t.event.universityId, meta: {} }, tx);
  });
}

export async function updateSeeds(actor: Actor, clubId: string, tournamentId: string, seeds: { participantId: string; seed: number }[]): Promise<void> {
  await db.$transaction(async (tx) => {
    const t = await loadTournamentInClub(tx, clubId, tournamentId);
    if (t.status !== "DRAFT") throw fail("NOT_EDITABLE");
    for (const s of seeds) {
      const { count } = await tx.participant.updateMany({ where: { id: s.participantId, tournamentId }, data: { seed: s.seed } });
      if (count === 0) throw fail("NOT_FOUND");
    }
    await audit({ action: "tournament.seeded", targetType: "Tournament", targetId: tournamentId, actorId: actor.id, universityId: t.event.universityId, meta: {} }, tx);
  });
}

export async function addParticipant(actor: Actor, clubId: string, tournamentId: string, displayName: string, seed?: number): Promise<void> {
  await db.$transaction(async (tx) => {
    const t = await loadTournamentInClub(tx, clubId, tournamentId);
    if (t.status !== "DRAFT" && t.status !== "SEEDED") throw fail("NOT_EDITABLE");
    const max = await tx.participant.aggregate({ where: { tournamentId }, _max: { seed: true } });
    await tx.participant.create({ data: { tournamentId, displayName, seed: seed ?? (max._max.seed ?? 0) + 1 } });
    await audit({ action: "tournament.participantAdded", targetType: "Tournament", targetId: tournamentId, actorId: actor.id, universityId: t.event.universityId, meta: { displayName } }, tx);
  });
}

/** Başladıktan sonra yalnızca isim değişikliği (TOURNAMENTS §7). */
export async function renameParticipant(actor: Actor, clubId: string, participantId: string, displayName: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const p = await tx.participant.findFirst({ where: { id: participantId }, select: { tournamentId: true } });
    if (!p) throw fail("NOT_FOUND");
    const t = await loadTournamentInClub(tx, clubId, p.tournamentId);
    const { count } = await tx.participant.updateMany({ where: { id: participantId }, data: { displayName } });
    if (count === 0) throw fail("NOT_FOUND");
    await audit({ action: "tournament.participantRenamed", targetType: "Participant", targetId: participantId, actorId: actor.id, universityId: t.event.universityId, meta: {} }, tx);
  });
}

export async function removeParticipant(actor: Actor, clubId: string, tournamentId: string, participantId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const t = await loadTournamentInClub(tx, clubId, tournamentId);
    if (t.status !== "DRAFT" && t.status !== "SEEDED") throw fail("NOT_EDITABLE");
    const { count } = await tx.participant.deleteMany({ where: { id: participantId, tournamentId } });
    if (count === 0) throw fail("NOT_FOUND");
    await audit({ action: "tournament.participantRemoved", targetType: "Tournament", targetId: tournamentId, actorId: actor.id, universityId: t.event.universityId, meta: { participantId } }, tx);
  });
}

const partSelect = { id: true, seed: true } as const satisfies Prisma.ParticipantSelect;

function toDomainParticipants(rows: { id: string; seed: number | null }[]): { byIndex: Map<number, string>; input: DomainParticipant[] } {
  const byIndex = new Map<number, string>();
  const input: DomainParticipant[] = rows.map((r, i) => {
    byIndex.set(i, r.id);
    return { index: i, seed: r.seed ?? i + 1 };
  });
  return { byIndex, input };
}

/**
 * Braket/fikstür üretir (DRAFT → SEEDED). SINGLE_ELIM/ROUND_ROBIN: tek aşama, tüm maçlar hemen
 * yazılır. GROUPS_KNOCKOUT: yalnızca grup aşaması üretilir; eleme aşaması yönetici kararıyla
 * ayrıca `generateKnockoutStage` ile oluşturulur (TOURNAMENTS §4 — otomatik değil).
 */
export async function generateBracket(actor: Actor, clubId: string, tournamentId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const t = await loadTournamentInClub(tx, clubId, tournamentId);
    if (t.status !== "DRAFT") throw fail("ALREADY_SEEDED");
    const rows = await tx.participant.findMany({ where: { tournamentId }, select: partSelect, orderBy: { seed: "asc" } });
    if (rows.length < 2) throw fail("TOO_FEW_PARTICIPANTS");
    const settings = t.settings as unknown as TournamentSettings;
    const { byIndex, input } = toDomainParticipants(rows);

    if (t.format === "SINGLE_ELIM") {
      const plan = generateSingleElimination(input, { thirdPlaceMatch: settings.thirdPlaceMatch });
      const stage = await tx.stage.create({ data: { tournamentId, order: 0, type: "KNOCKOUT", name: "Eleme", settings: {} }, select: { id: true } });
      await persistPlan(tx, stage.id, null, plan.matches, byIndex);
    } else if (t.format === "ROUND_ROBIN") {
      const plan = generateRoundRobin(input, { doubleRound: settings.doubleRoundRobin });
      const stage = await tx.stage.create({ data: { tournamentId, order: 0, type: "ROUND_ROBIN", name: "Lig", settings: {} }, select: { id: true } });
      await persistPlan(tx, stage.id, null, plan.matches, byIndex);
    } else if (t.format === "GROUPS_KNOCKOUT") {
      if (!settings.groups) throw fail("NOT_EDITABLE", { groups: "validation.required" });
      const groups = assignGroups(input, settings.groups.count);
      const stage = await tx.stage.create({ data: { tournamentId, order: 0, type: "ROUND_ROBIN", name: "Grup Aşaması", settings: { groupCount: settings.groups.count, advancePerGroup: settings.groups.advancePerGroup, bestThirds: settings.groups.bestThirds ?? 0 } }, select: { id: true } });
      for (const g of groups) {
        const groupRow = await tx.tournamentGroup.create({ data: { stageId: stage.id, name: `${g.groupKey} Grubu`, order: g.groupKey.charCodeAt(0) }, select: { id: true } });
        await tx.participant.updateMany({ where: { id: { in: g.participants.map((p) => byIndex.get(p.index)!) } }, data: { groupId: groupRow.id } });
        const plan = generateRoundRobin(g.participants);
        await persistPlan(tx, stage.id, groupRow.id, plan.matches, byIndex);
      }
    } else if (t.format === "DOUBLE_ELIM") {
      const plan = generateDoubleElimination(input, { grandFinalReset: settings.doubleElim?.grandFinalReset ?? false });
      const stage = await tx.stage.create({ data: { tournamentId, order: 0, type: "DOUBLE_KNOCKOUT", name: "Çift Eleme", settings: {} }, select: { id: true } });
      await persistPlan(tx, stage.id, null, plan.matches, byIndex);
    } else if (t.format === "SWISS") {
      const totalRounds = settings.swiss?.rounds ?? defaultSwissRounds(input.length);
      const stage = await tx.stage.create({ data: { tournamentId, order: 0, type: "SWISS", name: "İsviçre", settings: { totalRounds } }, select: { id: true } });
      const states: SwissPlayerState[] = input.map((p) => ({ index: p.index, points: 0, opponents: [], hadBye: false }));
      const round1 = generateSwissRound(states, { roundNumber: 1 });
      await persistPlan(tx, stage.id, null, round1, byIndex);
    } else if (t.format === "FREE_FOR_ALL") {
      const heatSize = settings.ffa?.heatSize ?? 8;
      const stage = await tx.stage.create({
        data: { tournamentId, order: 0, type: "FFA", name: "FFA", settings: { heatSize, pointsTable: settings.ffa?.pointsTable ?? [10, 8, 6, 5, 4, 3, 2, 1], advancePerHeat: settings.ffa?.advancePerHeat } },
        select: { id: true },
      });
      const heats = generateFfaHeats(input, { heatSize, advancePerHeat: settings.ffa?.advancePerHeat });
      await persistFfaHeats(tx, stage.id, heats, byIndex);
    }

    await tx.tournament.update({ where: { id: tournamentId }, data: { status: "SEEDED" } });
    await audit({ action: "tournament.bracketGenerated", targetType: "Tournament", targetId: tournamentId, actorId: actor.id, universityId: t.event.universityId, meta: { format: t.format } }, tx);
  });
}

async function persistPlan(tx: Tx, stageId: string, groupId: string | null, planMatches: ReturnType<typeof generateSingleElimination>["matches"], byIndex: Map<number, string>): Promise<void> {
  // Önce tüm maçları oluştur (next/loserNext DB id'lerini çözmek için round+position+side haritası gerekir).
  const created: { round: number; position: number; groupKey?: string; side?: string; id: string }[] = [];
  for (const m of planMatches) {
    const row = await tx.match.create({
      data: {
        stageId,
        groupId,
        round: m.round,
        position: m.position,
        groupKey: m.groupKey,
        side: m.side,
        homeId: m.homeIndex !== null ? byIndex.get(m.homeIndex) : null,
        awayId: m.awayIndex !== null ? byIndex.get(m.awayIndex) : null,
        status: m.status,
        winnerId: m.status === "BYE" && m.byeWinnerIndex !== undefined ? byIndex.get(m.byeWinnerIndex) : null,
      },
      select: { id: true },
    });
    created.push({ round: m.round, position: m.position, groupKey: m.groupKey, side: m.side, id: row.id });
  }
  // round+position tek başına çift elemede WINNERS/LOSERS arasında çakışabilir, side de eşleşmeli
  // (groupKey'li maçlar — GRAND_FINAL, THIRD_PLACE, HEAT_n — side'dan bağımsız tekildir).
  const findId = (round: number, position: number, groupKey?: string, side?: string) =>
    created.find((c) => c.round === round && c.position === position && c.groupKey === groupKey && (groupKey ? true : c.side === side))?.id;
  for (const m of planMatches) {
    const selfId = findId(m.round, m.position, m.groupKey, m.side)!;
    if (m.next) {
      // Hedef maç farklı side'da olabilir (WINNERS finali → FINAL); groupKey yoksa aynı side'da ara, sonra diğerlerinde dene.
      const nextId = findId(m.next.round, m.next.position, undefined, m.side) ?? created.find((c) => c.round === m.next!.round && c.position === m.next!.position)?.id;
      if (nextId) {
        await tx.match.update({ where: { id: selfId }, data: { nextMatchId: nextId, nextSlot: m.next.slot } });
        if (m.status === "BYE" && m.byeWinnerIndex !== undefined) {
          const winnerId = byIndex.get(m.byeWinnerIndex)!;
          await tx.match.update({ where: { id: nextId }, data: m.next.slot === "home" ? { homeId: winnerId } : { awayId: winnerId } });
        }
      }
    }
    // 3.lük maçı (tek eleme) loserNext'i kasıtlı olarak persist edilmez — matches.ts'teki
    // thirdPlaceTarget() round/position üzerinden dinamik hesaplar (F8 deseni). Burada yalnızca
    // çift elemenin WB→LB düşüşü (side dolu) için loserMatchId/loserSlot yazılır.
    if (m.loserNext && m.side) {
      // Normalde LOSERS brakete düşer; n=2 özel durumunda (LB yok) doğrudan FINAL'e düşer.
      const loserId = findId(m.loserNext.round, m.loserNext.position, undefined, "LOSERS") ?? findId(m.loserNext.round, m.loserNext.position, "GRAND_FINAL", "FINAL");
      if (loserId) await tx.match.update({ where: { id: selfId }, data: { loserMatchId: loserId, loserSlot: m.loserNext.slot } });
    }
  }
}

/** FFA heat'leri — homeId/awayId kullanılmaz, roster `ffaResults` içinde stub olarak saklanır. */
async function persistFfaHeats(tx: Tx, stageId: string, heats: ReturnType<typeof generateFfaHeats>, byIndex: Map<number, string>): Promise<void> {
  for (const h of heats) {
    await tx.match.create({
      data: {
        stageId,
        round: h.round,
        position: h.position,
        groupKey: h.groupKey,
        status: "PENDING",
        ffaResults: h.participantIndexes!.map((i) => ({ participantId: byIndex.get(i), rank: null, points: null })) as unknown as Prisma.InputJsonValue,
      },
    });
  }
}

// ---------------------------------------------------------------- Grup + eleme: eleme aşaması (manuel)

/**
 * "Eleme aşamasını oluştur" (TOURNAMENTS §4) — otomatik değil, yönetici grup sonuçları
 * kesinleşince tetikler. Grup standings'den çapraz tohumlanmış tek eleme braketi üretir.
 */
export async function generateKnockoutStage(actor: Actor, clubId: string, tournamentId: string, stageId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const t = await loadTournamentInClub(tx, clubId, tournamentId);
    if (t.format !== "GROUPS_KNOCKOUT") throw fail("NOT_EDITABLE");
    const groupStage = await tx.stage.findFirst({ where: { id: stageId, tournamentId }, select: { id: true, settings: true } });
    if (!groupStage) throw fail("NOT_FOUND");
    const existingKnockout = await tx.stage.findFirst({ where: { tournamentId, type: "KNOCKOUT" }, select: { id: true } });
    if (existingKnockout) throw fail("STAGE_EXISTS");

    const stageSettings = groupStage.settings as { groupCount: number; advancePerGroup: number; bestThirds: number };
    const groups = await tx.tournamentGroup.findMany({ where: { stageId }, orderBy: { order: "asc" }, select: { id: true, name: true, participants: { select: { id: true } } } });
    const allMatches = await tx.match.findMany({ where: { stageId, status: "COMPLETED" }, select: { groupId: true, homeId: true, awayId: true, homeScore: true, awayScore: true } });
    if (allMatches.length === 0) throw fail("GROUPS_NOT_DONE");
    const unfinished = await tx.match.count({ where: { stageId, status: { in: ["PENDING", "IN_PROGRESS"] } } });
    if (unfinished > 0) throw fail("GROUPS_NOT_DONE");

    const settings = t.settings as unknown as TournamentSettings;
    const idToIndex = new Map<string, number>();
    const indexToId: string[] = [];
    let next = 0;
    for (const g of groups) for (const p of g.participants) {
      idToIndex.set(p.id, next);
      indexToId.push(p.id);
      next++;
    }
    const domainMatches = allMatches.map((m) => ({ homeIndex: idToIndex.get(m.homeId!)!, awayIndex: idToIndex.get(m.awayId!)!, homeScore: m.homeScore!, awayScore: m.awayScore! }));

    const groupQualifiers = groups.map((g) => {
      const indexes = g.participants.map((p) => idToIndex.get(p.id)!);
      const rows = computeStandings(indexes, domainMatches.filter((m) => indexes.includes(m.homeIndex)), settings.points, settings.allowDraws);
      const ranked = rankStandings(rows, domainMatches, settings.points, settings.tiebreakers, settings.allowDraws);
      return { groupKey: g.name, rankedIndexes: ranked.map((r) => r.index) };
    });

    let bestThirdsOrder: string[] = [];
    if (stageSettings.bestThirds > 0) {
      const thirdCandidates = groupQualifiers
        .map((g) => ({ groupKey: g.groupKey, index: g.rankedIndexes[stageSettings.advancePerGroup] }))
        .filter((c): c is { groupKey: string; index: number } => c.index !== undefined);
      const thirdRows = computeStandings(
        thirdCandidates.map((c) => c.index),
        domainMatches,
        settings.points,
        settings.allowDraws,
      );
      const thirdRanked = rankStandings(thirdRows, domainMatches, settings.points, settings.tiebreakers, settings.allowDraws);
      bestThirdsOrder = thirdRanked.map((r) => thirdCandidates.find((c) => c.index === r.index)!.groupKey).slice(0, stageSettings.bestThirds);
    }

    const seeded = seedKnockoutFromGroups(groupQualifiers, stageSettings.advancePerGroup, bestThirdsOrder);
    if (seeded.length < 2) throw fail("TOO_FEW_PARTICIPANTS");
    const plan = generateSingleElimination(
      seeded.map((s) => ({ index: s.index, seed: s.seed })),
      { thirdPlaceMatch: settings.thirdPlaceMatch },
    );
    const byIndex = new Map(seeded.map((s) => [s.index, indexToId[s.index]!]));
    const stageOrder = await tx.stage.count({ where: { tournamentId } });
    const koStage = await tx.stage.create({ data: { tournamentId, order: stageOrder, type: "KNOCKOUT", name: "Eleme", settings: {} }, select: { id: true } });
    await persistPlan(tx, koStage.id, null, plan.matches, byIndex);
    await audit({ action: "tournament.knockoutGenerated", targetType: "Tournament", targetId: tournamentId, actorId: actor.id, universityId: t.event.universityId, meta: {} }, tx);
  });
}

// ---------------------------------------------------------------- İsviçre: sonraki turu üret (manuel)

/**
 * "Sonraki turu üret" (TOURNAMENTS §2.5) — önceki turun TAMAMEN bitmiş olmasını zorlar
 * (generateKnockoutStage'in "manuel tetikleme" deseniyle aynı). Puan/rakip geçmişi her
 * çağrıda ham maçlardan yeniden hesaplanır (cache yok, codebase konvansiyonu).
 */
export async function generateNextSwissRound(actor: Actor, clubId: string, tournamentId: string, stageId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const t = await loadTournamentInClub(tx, clubId, tournamentId);
    if (t.format !== "SWISS") throw fail("NOT_EDITABLE");
    const stage = await tx.stage.findFirst({ where: { id: stageId, tournamentId }, select: { id: true, settings: true } });
    if (!stage) throw fail("NOT_FOUND");
    const stageSettings = stage.settings as { totalRounds: number };

    const unfinished = await tx.match.count({ where: { stageId, status: { in: ["PENDING", "IN_PROGRESS"] } } });
    if (unfinished > 0) throw fail("ROUND_NOT_DONE");

    const allMatches = await tx.match.findMany({ where: { stageId }, select: { round: true, homeId: true, awayId: true, homeScore: true, awayScore: true, winnerId: true, status: true } });
    const currentRound = allMatches.reduce((max, m) => Math.max(max, m.round), 0);
    if (currentRound >= stageSettings.totalRounds) throw fail("TOURNAMENT_COMPLETE");

    const rows = await tx.participant.findMany({ where: { tournamentId }, select: partSelect, orderBy: { seed: "asc" } });
    const { byIndex, input } = toDomainParticipants(rows);
    const idToIndex = new Map([...byIndex.entries()].map(([i, id]) => [id, i]));

    const states: SwissPlayerState[] = input.map((p) => ({ index: p.index, points: 0, opponents: [], hadBye: false }));
    const byStateIndex = new Map(states.map((s) => [s.index, s]));
    for (const m of allMatches) {
      if (m.status === "BYE" && m.winnerId) {
        const s = byStateIndex.get(idToIndex.get(m.winnerId)!);
        if (s) {
          s.points += 1;
          s.hadBye = true;
        }
        continue;
      }
      if (!m.homeId || !m.awayId || m.homeScore === null || m.awayScore === null) continue;
      const home = byStateIndex.get(idToIndex.get(m.homeId)!);
      const away = byStateIndex.get(idToIndex.get(m.awayId)!);
      if (!home || !away) continue;
      home.opponents.push(away.index);
      away.opponents.push(home.index);
      if (m.homeScore > m.awayScore) home.points += 1;
      else if (m.awayScore > m.homeScore) away.points += 1;
      else {
        home.points += 0.5;
        away.points += 0.5;
      }
    }

    const nextRoundMatches = generateSwissRound([...byStateIndex.values()], { roundNumber: currentRound + 1 });
    await persistPlan(tx, stageId, null, nextRoundMatches, byIndex);
    await audit({ action: "tournament.swissRoundGenerated", targetType: "Tournament", targetId: tournamentId, actorId: actor.id, universityId: t.event.universityId, meta: { round: currentRound + 1 } }, tx);
  });
}

// ---------------------------------------------------------------- Venue + TimeSlot (planlama)

export async function createVenue(actor: Actor, clubId: string, tournamentId: string, name: string): Promise<{ id: string }> {
  const t = await loadTournamentInClub(db, clubId, tournamentId);
  const venue = await db.venue.create({ data: { tournamentId, name }, select: { id: true } });
  await audit({ action: "tournament.venueCreated", targetType: "Tournament", targetId: tournamentId, actorId: actor.id, universityId: t.event.universityId, meta: { name } });
  return venue;
}

export async function removeVenue(actor: Actor, clubId: string, venueId: string): Promise<void> {
  const venue = await db.venue.findUnique({ where: { id: venueId }, select: { tournamentId: true } });
  if (!venue) throw fail("NOT_FOUND");
  const t = await loadTournamentInClub(db, clubId, venue.tournamentId);
  await db.venue.delete({ where: { id: venueId } });
  await audit({ action: "tournament.venueRemoved", targetType: "Tournament", targetId: t.id, actorId: actor.id, universityId: t.event.universityId, meta: { venueId } });
}

export interface CreateTimeSlotInput {
  weekday: number;
  startMinute: number;
  endMinute: number;
  matchMinutes: number;
}

export async function createTimeSlot(actor: Actor, clubId: string, venueId: string, input: CreateTimeSlotInput): Promise<{ id: string }> {
  const venue = await db.venue.findUnique({ where: { id: venueId }, select: { tournamentId: true } });
  if (!venue) throw fail("NOT_FOUND");
  const t = await loadTournamentInClub(db, clubId, venue.tournamentId);
  const slot = await db.timeSlot.create({ data: { venueId, ...input }, select: { id: true } });
  await audit({ action: "tournament.timeSlotCreated", targetType: "Tournament", targetId: t.id, actorId: actor.id, universityId: t.event.universityId, meta: { venueId, ...input } });
  return slot;
}

export async function removeTimeSlot(actor: Actor, clubId: string, timeSlotId: string): Promise<void> {
  const slot = await db.timeSlot.findUnique({ where: { id: timeSlotId }, select: { venue: { select: { tournamentId: true } } } });
  if (!slot) throw fail("NOT_FOUND");
  const t = await loadTournamentInClub(db, clubId, slot.venue.tournamentId);
  await db.timeSlot.delete({ where: { id: timeSlotId } });
  await audit({ action: "tournament.timeSlotRemoved", targetType: "Tournament", targetId: t.id, actorId: actor.id, universityId: t.event.universityId, meta: { timeSlotId } });
}

/** Grup ayarlarını kaydeder (yalnızca `settings.groups`, diğer ayarlar korunur). */
export async function updateGroupsSettings(actor: Actor, clubId: string, tournamentId: string, input: { groupCount: number; advancePerGroup: number; bestThirds: number }): Promise<void> {
  await db.$transaction(async (tx) => {
    const t = await loadTournamentInClub(tx, clubId, tournamentId);
    if (t.status !== "DRAFT") throw fail("NOT_EDITABLE");
    const current = t.settings as unknown as TournamentSettings;
    const next: TournamentSettings = { ...current, groups: { count: input.groupCount, advancePerGroup: input.advancePerGroup, bestThirds: input.bestThirds || undefined } };
    await tx.tournament.update({ where: { id: tournamentId }, data: { settings: next as unknown as Prisma.InputJsonValue } });
    await audit({ action: "tournament.groupsSettingsUpdated", targetType: "Tournament", targetId: tournamentId, actorId: actor.id, universityId: t.event.universityId, meta: input }, tx);
  });
}
