import "server-only";

import { db } from "@/lib/db";
import type { Prisma } from "@/lib/db-types";

import { computeStandings, rankStandings, type StandingRow } from "./domain/standings";
import type { TournamentSettings } from "./schemas";

const participantSelect = {
  id: true,
  displayName: true,
  seed: true,
  groupId: true,
  withdrawnAt: true,
} as const;

export function listTournamentsForEvent(eventId: string) {
  return db.tournament.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, format: true, status: true, isPublic: true, _count: { select: { participants: true } } },
  });
}

export async function getTournament(clubId: string, tournamentId: string) {
  return db.tournament.findFirst({
    where: { id: tournamentId, event: { clubId } },
    select: {
      id: true,
      eventId: true,
      name: true,
      format: true,
      status: true,
      settings: true,
      isPublic: true,
      event: { select: { slug: true, titleTr: true, clubId: true, club: { select: { slug: true, name: true } } } },
      participants: { orderBy: { seed: "asc" }, select: participantSelect },
      stages: { orderBy: { order: "asc" }, select: { id: true, order: true, type: true, name: true, settings: true, groups: { orderBy: { order: "asc" }, select: { id: true, name: true } } } },
    },
  });
}

/**
 * `isPublic` turnuvalar girişsiz görüntülenebilir; ayrıca kendi katılımcısı olduğun (bireysel
 * veya takım üyesi) turnuvayı herkese açık olmasa da görebilirsin (kendi braketini görememek
 * kötü bir deneyim olurdu).
 */
export async function getPublicTournament(tournamentId: string, viewerId?: string) {
  const t = await db.tournament.findFirst({
    where: { id: tournamentId, OR: [{ isPublic: true }, ...(viewerId ? [{ participants: { some: { OR: [{ userId: viewerId }, { team: { members: { some: { userId: viewerId } } } }] } } }] : [])] },
    select: {
      id: true,
      name: true,
      format: true,
      status: true,
      settings: true,
      event: { select: { titleTr: true, club: { select: { name: true, slug: true } } } },
      participants: { orderBy: { seed: "asc" }, select: participantSelect },
      stages: { orderBy: { order: "asc" }, select: { id: true, order: true, type: true, name: true, settings: true, groups: { orderBy: { order: "asc" }, select: { id: true, name: true } } } },
    },
  });
  return t;
}

const matchViewSelect = {
  id: true,
  round: true,
  position: true,
  groupKey: true,
  groupId: true,
  homeId: true,
  awayId: true,
  homeScore: true,
  awayScore: true,
  winnerId: true,
  status: true,
  nextMatchId: true,
  nextSlot: true,
  scheduledAt: true,
  note: true,
} as const satisfies Prisma.MatchSelect;

export async function getStageMatches(stageId: string) {
  return db.match.findMany({ where: { stageId }, orderBy: [{ round: "asc" }, { position: "asc" }], select: matchViewSelect });
}

export type MatchView = Awaited<ReturnType<typeof getStageMatches>>[number];

/** Grup/lig standings — hesaplanır, saklanmaz (TOURNAMENTS §4). */
/**
 * Dönüş: `rows` yalnızca bu çağrıya özel yerel index'lerle (0,1,2…), `names` o index'leri
 * katılımcı adına çevirir — çağıran gerçek Participant.id'yi bilmek zorunda değildir.
 */
export async function getStandings(tournamentSettings: unknown, groupOrStageId: { groupId?: string; stageId?: string }): Promise<{ rows: StandingRow[]; names: Map<number, string> }> {
  const settings = tournamentSettings as TournamentSettings;
  const where = groupOrStageId.groupId ? { groupId: groupOrStageId.groupId } : { stageId: groupOrStageId.stageId, groupId: null };
  const matches = await db.match.findMany({ where: { ...where, status: { in: ["COMPLETED", "WALKOVER"] } }, select: { homeId: true, awayId: true, homeScore: true, awayScore: true } });
  const participants = groupOrStageId.groupId
    ? await db.participant.findMany({ where: { groupId: groupOrStageId.groupId }, select: participantSelect })
    : await db.participant.findMany({ where: { tournament: { stages: { some: { id: groupOrStageId.stageId } } } }, select: participantSelect });
  const idToIndex = new Map(participants.map((p, i) => [p.id, i]));
  const names = new Map(participants.map((p, i) => [i, p.displayName]));
  const domainMatches = matches
    .filter((m) => m.homeId && m.awayId && m.homeScore !== null && m.awayScore !== null)
    .map((m) => ({ homeIndex: idToIndex.get(m.homeId!)!, awayIndex: idToIndex.get(m.awayId!)!, homeScore: m.homeScore!, awayScore: m.awayScore! }));
  const rows = computeStandings([...idToIndex.values()], domainMatches, settings.points, settings.allowDraws);
  return { rows: rankStandings(rows, domainMatches, settings.points, settings.tiebreakers, settings.allowDraws), names };
}

/** "Maçlarım": kullanıcının bireysel/takım kaptanı/takım üyesi olduğu tüm maçlar. */
export async function getMyMatches(userId: string) {
  const participants = await db.participant.findMany({
    where: { OR: [{ userId }, { team: { members: { some: { userId } } } }] },
    select: { id: true, tournamentId: true, tournament: { select: { name: true, event: { select: { titleTr: true, club: { select: { name: true, slug: true } } } } } } },
  });
  const ids = participants.map((p) => p.id);
  if (ids.length === 0) return [];
  const matches = await db.match.findMany({
    where: { OR: [{ homeId: { in: ids } }, { awayId: { in: ids } }] },
    orderBy: [{ scheduledAt: "asc" }, { round: "asc" }],
    select: { ...matchViewSelect, stage: { select: { tournamentId: true, name: true } } },
  });
  const byParticipant = new Map(participants.map((p) => [p.id, p]));
  return matches.map((m) => ({ match: m, tournament: byParticipant.get(m.homeId ?? "")?.tournament ?? byParticipant.get(m.awayId ?? "")?.tournament }));
}
