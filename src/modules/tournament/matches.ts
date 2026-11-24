import "server-only";

import { audit } from "@/lib/audit";
import { db, type Tx } from "@/lib/db";
import type { Prisma } from "@/lib/db-types";
import { formatDateTime } from "@/lib/dates";
import { env } from "@/lib/env";
import { getMailRecipient } from "@/modules/identity";
import { notify, sendEmailSafe } from "@/modules/notification";

import { scoreFfaHeat } from "./domain/ffa";
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
  loserMatchId: true,
  loserSlot: true,
  venueId: true,
  ffaResults: true,
  stage: { select: { tournamentId: true, type: true, settings: true, tournament: { select: { settings: true, event: { select: { clubId: true, universityId: true } } } } } },
} as const;

async function loadMatchInClub(client: Tx | typeof db, clubId: string, matchId: string) {
  const m = await client.match.findFirst({ where: { id: matchId, stage: { tournament: { event: { clubId } } } }, select: matchSelect });
  if (!m) throw fail("MATCH_NOT_FOUND");
  return m;
}

/** Bu maç tamamlanmışsa ve ilerlediği yer (next/3.lük) de oynanmışsa true — düzeltme onay ister. */
async function downstreamPlayed(tx: Tx, match: Awaited<ReturnType<typeof loadMatchInClub>>): Promise<boolean> {
  if (match.groupKey?.startsWith("HEAT_")) return false; // FFA'da nextMatchId zinciri yok
  if (match.status !== "COMPLETED") return false;
  const targets: string[] = [];
  if (match.nextMatchId) targets.push(match.nextMatchId);
  if (match.loserMatchId) targets.push(match.loserMatchId);
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
  if (match.loserMatchId && match.loserSlot) {
    const loserTarget = await tx.match.findUnique({ where: { id: match.loserMatchId }, select: matchSelect });
    if (loserTarget) {
      await tx.match.update({ where: { id: loserTarget.id }, data: match.loserSlot === "home" ? { homeId: null } : { awayId: null } });
      if (loserTarget.status === "COMPLETED") {
        await resetDownstream(tx, loserTarget);
        await tx.match.update({ where: { id: loserTarget.id }, data: { status: "PENDING", homeScore: null, awayScore: null, winnerId: null } });
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
    const isKnockout = match.groupId === null && (match.stage.type === "KNOCKOUT" || match.stage.type === "DOUBLE_KNOCKOUT");
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
      // Çift elemede WB→LB düşüş: kaybeden loserMatchId'nin ilgili slotuna yerleşir.
      if (match.loserMatchId && match.loserSlot) {
        await tx.match.update({ where: { id: match.loserMatchId }, data: match.loserSlot === "home" ? { homeId: loserId } : { awayId: loserId } });
      }
    }

    // Çift elemede büyük final: WINNERS finalisti (home) kazanırsa reset maçı gereksiz → BYE ile voide edilir.
    // Alt braketten gelen (away) kazanırsa reset maçı aynı iki katılımcıyla oynanır.
    if (match.groupKey === "GRAND_FINAL" && winnerId) {
      const reset = await tx.match.findFirst({ where: { stageId: match.stageId, groupKey: "GRAND_FINAL_RESET" }, select: { id: true } });
      if (reset) {
        if (winnerId === match.homeId) {
          await tx.match.update({ where: { id: reset.id }, data: { status: "BYE", winnerId, homeId: match.homeId, awayId: match.awayId } });
        } else {
          await tx.match.update({ where: { id: reset.id }, data: { homeId: match.homeId, awayId: match.awayId } });
        }
      }
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

/** Katılımcının (bireysel veya takım) tüm üyelerinin kullanıcı id'leri. */
async function participantUserIds(tx: Tx | typeof db, participantId: string): Promise<string[]> {
  const p = await tx.participant.findUnique({ where: { id: participantId }, select: { userId: true, teamId: true, displayName: true } });
  if (!p) return [];
  if (p.teamId) {
    const members = await tx.teamMember.findMany({ where: { teamId: p.teamId }, select: { userId: true } });
    return members.map((m) => m.userId);
  }
  return p.userId ? [p.userId] : [];
}

export interface ScheduleInput {
  scheduledAt: Date;
  venueId?: string | null;
  forceConflict?: boolean;
}

/** Bu maçı yeni saat/sahaya koyarsak oluşacak çakışma nedenleri (boş = çakışma yok). */
async function schedulingConflict(tx: Tx, match: Awaited<ReturnType<typeof loadMatchInClub>>, input: ScheduleInput): Promise<string[]> {
  if (!input.venueId) return [];
  const reasons: string[] = [];
  const settings = match.stage.tournament.settings as unknown as TournamentSettings & { scheduling?: { minRestMin?: number; maxMatchesPerDay?: number } };
  const minRestMin = settings.scheduling?.minRestMin ?? 0;
  const maxMatchesPerDay = settings.scheduling?.maxMatchesPerDay ?? 999;
  const windowStart = new Date(input.scheduledAt.getTime() - minRestMin * 60_000);
  const windowEnd = new Date(input.scheduledAt.getTime() + minRestMin * 60_000);

  const sameVenue = await tx.match.findFirst({
    where: { id: { not: match.id }, venueId: input.venueId, scheduledAt: { gte: windowStart, lte: windowEnd } },
    select: { id: true },
  });
  if (sameVenue) reasons.push("venue");

  const participantIds = [match.homeId, match.awayId].filter((v): v is string => !!v);
  if (participantIds.length > 0) {
    const dayStart = new Date(input.scheduledAt);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const sameDay = await tx.match.count({
      where: { id: { not: match.id }, scheduledAt: { gte: dayStart, lt: dayEnd }, OR: [{ homeId: { in: participantIds } }, { awayId: { in: participantIds } }] },
    });
    if (sameDay >= maxMatchesPerDay) reasons.push("maxPerDay");
    const rest = await tx.match.findFirst({
      where: { id: { not: match.id }, scheduledAt: { gte: windowStart, lte: windowEnd }, OR: [{ homeId: { in: participantIds } }, { awayId: { in: participantIds } }] },
      select: { id: true },
    });
    if (rest) reasons.push("rest");
  }
  return reasons;
}

/** Maç saati/sahasını belirler/değiştirir, her iki tarafın üyelerine mail + bildirim gönderir. Çakışma varsa (hata değil) onay istenir. */
export async function scheduleMatch(actor: Actor, clubId: string, matchId: string, input: ScheduleInput): Promise<void> {
  const match = await db.$transaction(async (tx) => {
    const match = await loadMatchInClub(tx, clubId, matchId);
    if (!match.homeId || !match.awayId) throw fail("MATCH_NOT_EDITABLE");
    const conflicts = await schedulingConflict(tx, match, input);
    if (conflicts.length > 0 && !input.forceConflict) throw fail("SCHEDULE_CONFLICT", { cascade: "tournament.errors.scheduleConflict" });
    await tx.match.update({ where: { id: matchId }, data: { scheduledAt: input.scheduledAt, venueId: input.venueId ?? undefined, updatedById: actor.id } });
    await audit(
      { action: "tournament.scheduled", targetType: "Match", targetId: matchId, actorId: actor.id, universityId: match.stage.tournament.event.universityId, meta: { scheduledAt: input.scheduledAt.toISOString(), venueId: input.venueId ?? null, forcedConflict: conflicts.length > 0 } },
      tx,
    );
    return match;
  });
  const [home, away] = await Promise.all([participantUserIds(db, match.homeId!), participantUserIds(db, match.awayId!)]);
  const homeDisplay = await db.participant.findUnique({ where: { id: match.homeId! }, select: { displayName: true } });
  const awayDisplay = await db.participant.findUnique({ where: { id: match.awayId! }, select: { displayName: true } });
  const event = await db.tournament.findUnique({ where: { id: match.stage.tournamentId }, select: { event: { select: { titleTr: true } } } });
  const eventTitle = event?.event.titleTr ?? "";
  await Promise.all([
    ...home.map((userId) => notifyMatchScheduled(userId, eventTitle, awayDisplay?.displayName ?? "", input.scheduledAt)),
    ...away.map((userId) => notifyMatchScheduled(userId, eventTitle, homeDisplay?.displayName ?? "", input.scheduledAt)),
  ]);
}

async function notifyMatchScheduled(userId: string, eventTitle: string, opponent: string, scheduledAt: Date): Promise<void> {
  const recipient = await getMailRecipient(db, userId);
  const when = formatDateTime(scheduledAt, recipient?.locale ?? "tr");
  await notify({
    userId,
    type: "MATCH_UPDATE",
    titleTr: "Maç saati belirlendi",
    titleEn: "Match scheduled",
    bodyTr: `${opponent} — ${when}`,
    bodyEn: `${opponent} — ${when}`,
    href: "/maclarim",
  });
  if (!recipient) return;
  await sendEmailSafe(recipient.email, "match-scheduled", recipient.locale, { name: recipient.name, eventTitle, opponent, scheduledAt: when, url: `${env.APP_URL}/maclarim` });
}

/** FFA heat sonucu girer (TOURNAMENTS §2.6) — roster doğrulanır, puan tablosu varsa uygulanır. */
export async function recordFfaHeatResult(actor: Actor, clubId: string, matchId: string, results: FfaResultInputItem[]): Promise<void> {
  await db.$transaction(async (tx) => {
    const match = await loadMatchInClub(tx, clubId, matchId);
    if (!match.groupKey?.startsWith("HEAT_")) throw fail("MATCH_NOT_EDITABLE");
    const roster = (match.ffaResults as { participantId: string }[] | null) ?? [];
    const rosterIds = new Set(roster.map((r) => r.participantId));
    const resultIds = new Set(results.map((r) => r.participantId));
    if (rosterIds.size !== resultIds.size || [...rosterIds].some((id) => !resultIds.has(id))) throw fail("INVALID_SCORE");

    const stageSettings = match.stage.settings as { pointsTable?: number[] };
    const scored = stageSettings.pointsTable
      ? scoreFfaHeat(
          results.map((r) => ({ participantIndex: 0, rank: r.rank, points: r.points, time: r.time, score: r.score })),
          { byRank: stageSettings.pointsTable },
        )
      : results.map((r) => ({ participantIndex: 0, rank: r.rank, points: r.points, time: r.time, score: r.score }));

    const ffaResults = results.map((r, i) => ({ participantId: r.participantId, rank: r.rank, points: scored[i]!.points ?? null, time: r.time ?? null, score: r.score ?? null }));
    await tx.match.update({ where: { id: matchId }, data: { status: "COMPLETED", ffaResults: ffaResults as unknown as Prisma.InputJsonValue, updatedById: actor.id } });
    await audit({ action: "tournament.ffaResultRecorded", targetType: "Match", targetId: matchId, actorId: actor.id, universityId: match.stage.tournament.event.universityId, meta: {} }, tx);
  });
}

export interface FfaResultInputItem {
  participantId: string;
  rank: number;
  points?: number;
  time?: number;
  score?: number;
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
