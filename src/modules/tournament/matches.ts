import "server-only";

import { audit } from "@/lib/audit";
import { db, type Tx } from "@/lib/db";

import type { TournamentSettings } from "./schemas";
import { fail } from "./service";

interface Actor {
  id: string;
}

const matchSelect = {
  id: true,
  stageId: true,
  groupId: true,
  round: true,
  position: true,
  groupKey: true,
  homeId: true,
  awayId: true,
  homeScore: true,
  awayScore: true,
  winnerId: true,
  status: true,
  nextMatchId: true,
  nextSlot: true,
  stage: { select: { tournamentId: true, type: true, tournament: { select: { settings: true, event: { select: { clubId: true, universityId: true } } } } } },
} as const;

async function loadMatchInClub(client: Tx | typeof db, clubId: string, matchId: string) {
  const m = await client.match.findFirst({ where: { id: matchId, stage: { tournament: { event: { clubId } } } }, select: matchSelect });
  if (!m) throw fail("MATCH_NOT_FOUND");
  return m;
}

/** Bu maç tamamlanmışsa ve ilerlediği yer (next/3.lük) de oynanmışsa true — düzeltme onay ister. */
async function downstreamPlayed(tx: Tx, match: Awaited<ReturnType<typeof loadMatchInClub>>): Promise<boolean> {
  if (match.status !== "COMPLETED") return false;
  const targets: string[] = [];
  if (match.nextMatchId) targets.push(match.nextMatchId);
  const third = await thirdPlaceTarget(tx, match);
  if (third) targets.push(third.matchId);
  if (targets.length === 0) return false;
  const rows = await tx.match.findMany({ where: { id: { in: targets } }, select: { status: true } });
  return rows.some((r) => r.status !== "PENDING");
}

/** Yarı final ise ve aşamada 3.lük maçı varsa, kaybedenin gideceği maç + slot'u döner. */
async function thirdPlaceTarget(tx: Tx, match: Awaited<ReturnType<typeof loadMatchInClub>>): Promise<{ matchId: string; slot: "home" | "away" } | null> {
  if (match.groupKey) return null;
  const maxRound = await tx.match.aggregate({ where: { stageId: match.stageId, groupId: null }, _max: { round: true } });
  const finalRound = maxRound._max.round ?? 0;
  if (match.round !== finalRound - 1 || (match.position !== 0 && match.position !== 1)) return null;
  const third = await tx.match.findFirst({ where: { stageId: match.stageId, round: finalRound, groupKey: "THIRD_PLACE" }, select: { id: true } });
  if (!third) return null;
  return { matchId: third.id, slot: match.position === 0 ? "home" : "away" };
}

/** Bir maçın ilerlettiği (next/3.lük) hedefleri temizler — düzeltmede zincirleme sıfırlama. */
async function resetDownstream(tx: Tx, match: Awaited<ReturnType<typeof loadMatchInClub>>): Promise<void> {
  if (match.nextMatchId && match.nextSlot) {
    const next = await tx.match.findUnique({ where: { id: match.nextMatchId }, select: matchSelect });
    if (next) {
      await tx.match.update({
        where: { id: next.id },
        data: match.nextSlot === "home" ? { homeId: null } : { awayId: null },
      });
      if (next.status === "COMPLETED") {
        await resetDownstream(tx, next);
        await tx.match.update({ where: { id: next.id }, data: { status: "PENDING", homeScore: null, awayScore: null, winnerId: null } });
      }
    }
  }
  const third = await thirdPlaceTarget(tx, match);
  if (third) {
    await tx.match.update({ where: { id: third.matchId }, data: third.slot === "home" ? { homeId: null } : { awayId: null } });
  }
}

export interface ScoreInput {
  homeScore: number;
  awayScore: number;
  forceCascade?: boolean;
}

/**
 * Skor girişi + ilerleme (TOURNAMENTS §3). Beraberlik tek elemede kabul edilmez (walkover/penaltı
 * kullanıcı tarafında skor olarak girilir — "deplasman golü yok" basitleştirmesiyle MVP'de). Transaction.
 */
export async function recordScore(actor: Actor, clubId: string, matchId: string, input: ScoreInput): Promise<void> {
  await db.$transaction(async (tx) => {
    const match = await loadMatchInClub(tx, clubId, matchId);
    if (match.status === "BYE") throw fail("MATCH_NOT_EDITABLE");
    if (!match.homeId || !match.awayId) throw fail("MATCH_NOT_EDITABLE");
    const isDraw = input.homeScore === input.awayScore;
    const isKnockout = match.groupId === null && match.stage.type === "KNOCKOUT";
    const settings = match.stage.tournament.settings as unknown as TournamentSettings;
    if (isDraw && (isKnockout || !settings.allowDraws)) throw fail("INVALID_SCORE", { awayScore: "tournament.errors.noDraw" });

    if (await downstreamPlayed(tx, match)) {
      if (!input.forceCascade) throw fail("DOWNSTREAM_PLAYED", { cascade: "tournament.errors.downstreamPlayed" });
      await resetDownstream(tx, match);
    } else if (match.status === "COMPLETED") {
      await resetDownstream(tx, match);
    }

    const winnerId = input.homeScore === input.awayScore ? null : input.homeScore > input.awayScore ? match.homeId : match.awayId;
    const loserId = winnerId === null ? null : winnerId === match.homeId ? match.awayId : match.homeId;
    await tx.match.update({
      where: { id: matchId },
      data: { homeScore: input.homeScore, awayScore: input.awayScore, winnerId, status: "COMPLETED", updatedById: actor.id },
    });

    if (winnerId && match.nextMatchId && match.nextSlot) {
      await tx.match.update({ where: { id: match.nextMatchId }, data: match.nextSlot === "home" ? { homeId: winnerId } : { awayId: winnerId } });
    }
    if (loserId) {
      const third = await thirdPlaceTarget(tx, match);
      if (third) await tx.match.update({ where: { id: third.matchId }, data: third.slot === "home" ? { homeId: loserId } : { awayId: loserId } });
    }

    await syncTournamentStatus(tx, match.stage.tournamentId);
    await audit(
      { action: "tournament.scoreRecorded", targetType: "Match", targetId: matchId, actorId: actor.id, universityId: match.stage.tournament.event.universityId, meta: { homeScore: input.homeScore, awayScore: input.awayScore } },
      tx,
    );
  });
}

export async function recordWalkover(actor: Actor, clubId: string, matchId: string, winner: "home" | "away", reason: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const match = await loadMatchInClub(tx, clubId, matchId);
    if (!match.homeId || !match.awayId) throw fail("MATCH_NOT_EDITABLE");
    const winnerId = winner === "home" ? match.homeId : match.awayId;
    const loserId = winner === "home" ? match.awayId : match.homeId;
    await tx.match.update({ where: { id: matchId }, data: { status: "WALKOVER", winnerId, note: reason, updatedById: actor.id } });
    if (match.nextMatchId && match.nextSlot) await tx.match.update({ where: { id: match.nextMatchId }, data: match.nextSlot === "home" ? { homeId: winnerId } : { awayId: winnerId } });
    const third = await thirdPlaceTarget(tx, match);
    if (third) await tx.match.update({ where: { id: third.matchId }, data: third.slot === "home" ? { homeId: loserId } : { awayId: loserId } });
    await syncTournamentStatus(tx, match.stage.tournamentId);
    await audit({ action: "tournament.walkover", targetType: "Match", targetId: matchId, actorId: actor.id, universityId: match.stage.tournament.event.universityId, meta: { winner, reason } }, tx);
  });
}

export async function postponeMatch(actor: Actor, clubId: string, matchId: string, note: string | undefined): Promise<void> {
  await db.$transaction(async (tx) => {
    const match = await loadMatchInClub(tx, clubId, matchId);
    await tx.match.update({ where: { id: matchId }, data: { status: "POSTPONED", note, updatedById: actor.id } });
    await audit({ action: "tournament.postponed", targetType: "Match", targetId: matchId, actorId: actor.id, universityId: match.stage.tournament.event.universityId, meta: {} }, tx);
  });
}

/** İlk skor girilince SEEDED → IN_PROGRESS (TOURNAMENTS §7: "başladıktan sonra" katılımcı kilitlenir); son maç bitince COMPLETED. */
async function syncTournamentStatus(tx: Tx, tournamentId: string): Promise<void> {
  const unfinished = await tx.match.count({ where: { stage: { tournamentId }, status: { in: ["PENDING", "IN_PROGRESS", "POSTPONED"] } } });
  if (unfinished === 0) {
    await tx.tournament.updateMany({ where: { id: tournamentId, status: { not: "COMPLETED" } }, data: { status: "COMPLETED" } });
  } else {
    await tx.tournament.updateMany({ where: { id: tournamentId, status: "SEEDED" }, data: { status: "IN_PROGRESS" } });
  }
}
