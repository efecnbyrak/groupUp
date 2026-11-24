import "server-only";

import { db } from "@/lib/db";

import { isCandidacyWindowOpen, isVotingWindowOpen } from "./domain/state-machine";
import { syncElectionTimeStatus } from "./service";

const electionSelect = {
  id: true,
  clubId: true,
  title: true,
  status: true,
  candidacyOpensAt: true,
  candidacyClosesAt: true,
  votingOpensAt: true,
  votingClosesAt: true,
  eligibleSnapshotAt: true,
  winnerUserId: true,
  createdAt: true,
  candidates: {
    where: { approved: true },
    select: { id: true, userId: true, statementTr: true, user: { select: { email: true, profile: { select: { firstName: true, lastName: true, avatarKey: true } } } } },
  },
} as const;

/** Kulüp sayfası bandı: en güncel seçim + görüntüleyenin adaylık/oy durumu. */
export async function getClubElectionBanner(clubId: string, userId: string | null) {
  await syncElectionTimeStatus();
  const election = await db.election.findFirst({ where: { clubId }, orderBy: { createdAt: "desc" }, select: electionSelect });
  if (!election) return null;
  const now = new Date();
  const [isCandidate, hasVoted] = userId
    ? await Promise.all([
        db.candidate.findUnique({ where: { electionId_userId: { electionId: election.id, userId } }, select: { id: true } }),
        db.ballotReceipt.findUnique({ where: { electionId_userId: { electionId: election.id, userId } }, select: { userId: true } }),
      ])
    : [null, null];
  return {
    ...election,
    candidacyOpen: election.status === "CANDIDACY" && isCandidacyWindowOpen(election, now),
    votingOpen: election.status === "VOTING" && isVotingWindowOpen(election, now),
    viewerIsCandidate: !!isCandidate,
    viewerHasVoted: !!hasVoted,
  };
}

export type ClubElectionBanner = Awaited<ReturnType<typeof getClubElectionBanner>>;

/** FINALIZED seçim sonucu — aday başına oy/yüzde (ELECTIONS §3, oy kapandıktan sonra herkese). */
export async function getElectionResult(electionId: string) {
  const election = await db.election.findUnique({
    where: { id: electionId },
    select: { id: true, clubId: true, title: true, status: true, winnerUserId: true, votingClosesAt: true },
  });
  if (!election || (election.status !== "FINALIZED" && election.status !== "CANCELLED")) return null;
  const [candidates, votes] = await Promise.all([
    db.candidate.findMany({ where: { electionId, approved: true }, select: { id: true, userId: true, user: { select: { profile: { select: { firstName: true, lastName: true } } } } } }),
    db.vote.groupBy({ by: ["candidateId"], where: { electionId }, _count: true }),
  ]);
  const total = votes.reduce((sum, v) => sum + v._count, 0);
  const countOf = (candidateId: string) => votes.find((v) => v.candidateId === candidateId)?._count ?? 0;
  return {
    election,
    total,
    rows: candidates.map((c) => ({ candidateId: c.id, userId: c.userId, name: c.user.profile ? `${c.user.profile.firstName} ${c.user.profile.lastName}` : "", votes: countOf(c.id), pct: total ? Math.round((countOf(c.id) / total) * 100) : 0 })),
    noVotes: candidates.length === 1 ? countOf("NO") : null,
  };
}

/** Admin: üniversitedeki seçimler (en güncel önce). */
export async function listElectionsForAdmin(universityId: string) {
  await syncElectionTimeStatus();
  return db.election.findMany({
    where: { universityId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      candidacyOpensAt: true,
      candidacyClosesAt: true,
      votingOpensAt: true,
      votingClosesAt: true,
      eligibleSnapshotAt: true,
      club: { select: { id: true, slug: true, name: true } },
      candidates: { select: { id: true, approved: true, statementTr: true, userId: true, user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } } } },
      _count: { select: { ballots: true } },
    },
  });
}

/** Admin: kulüpte devam eden (aktif) seçim var mı — yeni seçim formu kulüp seçeneklerini süzer. */
export async function clubsWithoutActiveElection(universityId: string) {
  const clubs = await db.club.findMany({ where: { universityId, deletedAt: null, status: "ACTIVE" }, select: { id: true, name: true } });
  const active = await db.election.findMany({ where: { universityId, status: { in: ["DRAFT", "CANDIDACY", "VOTING", "CLOSED", "RESULT_PENDING"] } }, select: { clubId: true } });
  const busy = new Set(active.map((e) => e.clubId));
  return clubs.filter((c) => !busy.has(c.id));
}

/** Oy penceresinde katılım oranı için uygun seçmen sayısı (eligibleSnapshotAt dondurulduktan sonra). */
export async function eligibleVoterCount(clubId: string, snapshotAt: Date): Promise<number> {
  return db.membership.count({ where: { clubId, status: "ACTIVE", joinedAt: { lte: snapshotAt } } });
}
