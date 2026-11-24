import "server-only";

import { db, type Tx } from "@/lib/db";
import { ServiceError } from "@/lib/errors";

import { deriveTimeStatus, isCandidacyWindowOpen, isVotingWindowOpen, tally, validateWindow, type ElectionWindow } from "./domain/state-machine";
import type { CreateElectionInput } from "./schemas";

export type ElectionErrorCode =
  | "NOT_FOUND"
  | "INVALID_DATES"
  | "ACTIVE_ELECTION_EXISTS"
  | "NOT_CANDIDACY_WINDOW"
  | "NOT_VOTING_WINDOW"
  | "NOT_ELIGIBLE"
  | "ALREADY_CANDIDATE"
  | "CANDIDATE_NOT_APPROVED"
  | "ALREADY_VOTED"
  | "INVALID_CANDIDATE";

export const fail = (code: ElectionErrorCode, fields?: Record<string, string>) => new ServiceError(code, fields);

const ACTIVE_STATUSES = ["DRAFT", "CANDIDACY", "VOTING", "CLOSED", "RESULT_PENDING"] as const;

function windowOf(e: { candidacyOpensAt: Date; candidacyClosesAt: Date; votingOpensAt: Date; votingClosesAt: Date }): ElectionWindow {
  return e;
}

/** Admin: kulüpte aktif (devam eden) seçim yoksa yeni seçim oluştur. */
export async function createElection(actor: { id: string }, universityId: string, input: CreateElectionInput): Promise<{ id: string }> {
  if (!validateWindow(input)) throw fail("INVALID_DATES");
  return db.$transaction(async (tx) => {
    const club = await tx.club.findFirst({ where: { id: input.clubId, universityId, deletedAt: null }, select: { id: true } });
    if (!club) throw fail("NOT_FOUND");
    const existing = await tx.election.findFirst({ where: { clubId: input.clubId, status: { in: [...ACTIVE_STATUSES] } }, select: { id: true } });
    if (existing) throw fail("ACTIVE_ELECTION_EXISTS");
    const election = await tx.election.create({
      data: {
        universityId,
        clubId: input.clubId,
        title: input.title,
        candidacyOpensAt: input.candidacyOpensAt,
        candidacyClosesAt: input.candidacyClosesAt,
        votingOpensAt: input.votingOpensAt,
        votingClosesAt: input.votingClosesAt,
        createdById: actor.id,
      },
      select: { id: true },
    });
    return election;
  });
}

/** Admin: seçimi iptal et (henüz sonuçlanmamışsa). */
export async function cancelElection(universityId: string, electionId: string): Promise<void> {
  const { count } = await db.election.updateMany({
    where: { id: electionId, universityId, status: { in: ["DRAFT", "CANDIDACY", "VOTING", "CLOSED", "RESULT_PENDING"] } },
    data: { status: "CANCELLED" },
  });
  if (count === 0) throw fail("NOT_FOUND");
}

async function assertEligible(client: Tx | typeof db, clubId: string, userId: string, snapshotAt: Date | null): Promise<void> {
  const user = await client.user.findUnique({ where: { id: userId }, select: { type: true, status: true, deletedAt: true } });
  if (!user || user.type !== "STUDENT" || user.status !== "ACTIVE" || user.deletedAt) throw fail("NOT_ELIGIBLE");
  const membership = await client.membership.findUnique({ where: { clubId_userId: { clubId, userId } }, select: { status: true, joinedAt: true } });
  if (!membership || membership.status !== "ACTIVE") throw fail("NOT_ELIGIBLE");
  if (snapshotAt && membership.joinedAt.getTime() > snapshotAt.getTime()) throw fail("NOT_ELIGIBLE");
  const presidentElsewhere = await client.club.findFirst({ where: { presidentId: userId, id: { not: clubId }, deletedAt: null }, select: { id: true } });
  if (presidentElsewhere) throw fail("NOT_ELIGIBLE");
}

/** Üye: adaylık başvurusu (ELECTIONS §2 — seçmen kriterleri + başka kulübün başkanı olmamak). */
export async function applyCandidacy(actor: { id: string }, electionId: string, statementTr: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const election = await tx.election.findUnique({
      where: { id: electionId },
      select: { id: true, clubId: true, status: true, candidacyOpensAt: true, candidacyClosesAt: true, votingOpensAt: true, votingClosesAt: true },
    });
    if (!election) throw fail("NOT_FOUND");
    if (election.status !== "CANDIDACY" || !isCandidacyWindowOpen(windowOf(election), new Date())) throw fail("NOT_CANDIDACY_WINDOW");
    await assertEligible(tx, election.clubId, actor.id, null);
    const existing = await tx.candidate.findUnique({ where: { electionId_userId: { electionId, userId: actor.id } }, select: { id: true } });
    if (existing) throw fail("ALREADY_CANDIDATE");
    await tx.candidate.create({ data: { electionId, userId: actor.id, statementTr } });
  });
}

/** Admin: adaylığı onayla/reddet (oy pusulasına girer veya girmez). */
export async function decideCandidacy(universityId: string, candidateId: string, approved: boolean): Promise<void> {
  await db.$transaction(async (tx) => {
    const candidate = await tx.candidate.findUnique({ where: { id: candidateId }, select: { election: { select: { universityId: true, status: true } } } });
    if (!candidate || candidate.election.universityId !== universityId) throw fail("NOT_FOUND");
    if (candidate.election.status !== "CANDIDACY" && candidate.election.status !== "DRAFT") throw fail("NOT_CANDIDACY_WINDOW");
    if (!approved) {
      await tx.candidate.delete({ where: { id: candidateId } });
      return;
    }
    await tx.candidate.update({ where: { id: candidateId }, data: { approved: true } });
  });
}

/** Üye: oy ver. Kişi başı bir oy, değiştirilemez (ELECTIONS §2 — gizlilik: Vote/BallotReceipt bağlantısız). */
export async function castVote(actor: { id: string }, electionId: string, candidateId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const election = await tx.election.findUnique({
      where: { id: electionId },
      select: { id: true, clubId: true, status: true, candidacyOpensAt: true, candidacyClosesAt: true, votingOpensAt: true, votingClosesAt: true, eligibleSnapshotAt: true },
    });
    if (!election) throw fail("NOT_FOUND");
    if (election.status !== "VOTING" || !isVotingWindowOpen(windowOf(election), new Date())) throw fail("NOT_VOTING_WINDOW");
    await assertEligible(tx, election.clubId, actor.id, election.eligibleSnapshotAt);
    const receipt = await tx.ballotReceipt.findUnique({ where: { electionId_userId: { electionId, userId: actor.id } }, select: { userId: true } });
    if (receipt) throw fail("ALREADY_VOTED");
    const approvedCount = await tx.candidate.count({ where: { electionId, approved: true } });
    if (candidateId !== "NO") {
      const candidate = await tx.candidate.findUnique({ where: { id: candidateId }, select: { electionId: true, approved: true } });
      if (!candidate || candidate.electionId !== electionId || !candidate.approved) throw fail("INVALID_CANDIDATE");
    } else if (approvedCount !== 1) {
      throw fail("INVALID_CANDIDATE"); // "NO" yalnızca tek adaylı Evet/Hayır oylamasında geçerli
    }
    await tx.vote.create({ data: { electionId, candidateId } });
    await tx.ballotReceipt.create({ data: { electionId, userId: actor.id } });
  });
}

/**
 * Cron / sayfa açılışı: zaman tabanlı geçişleri uygular (DEPLOYMENT §3 — "lazy" kontrol).
 * VOTING'e geçerken `eligibleSnapshotAt` o an dondurulur (ELECTIONS §2).
 */
export async function syncElectionTimeStatus(now = new Date()): Promise<number> {
  const elections = await db.election.findMany({
    where: { status: { in: ["DRAFT", "CANDIDACY", "VOTING"] } },
    select: { id: true, status: true, candidacyOpensAt: true, candidacyClosesAt: true, votingOpensAt: true, votingClosesAt: true },
  });
  let changed = 0;
  for (const e of elections) {
    const target = deriveTimeStatus(e.status, windowOf(e), now);
    if (!target || target === e.status) continue;
    // Cron geç çalışsa bile (DEPLOYMENT §3) tek adımda VOTING'i atlayıp CLOSED'a geçebilir;
    // seçmen dondurma anı her durumda planlanan votingOpensAt (ELECTIONS §2), cron'un çalıştığı an değil.
    const snapshot = target === "VOTING" || target === "CLOSED" ? { eligibleSnapshotAt: e.votingOpensAt } : {};
    await db.election.update({ where: { id: e.id }, data: { status: target, ...snapshot } });
    changed++;
  }
  return changed;
}

export interface StagedResult {
  electionId: string;
  universityId: string;
  clubId: string;
  createdById: string;
  winnerUserId: string | null;
  tie: boolean;
  counts: Record<string, number>;
  totalBallots: number;
}

/**
 * CLOSED seçimler: ELECTION_RESULT talebi henüz oluşturulmamışsa oy sayımını hesaplar.
 * Talep oluşturma (`approval.submitRequest`) ve `markResultPending` cron route'ta (app katmanı
 * iki modülü de import edebilir; election → approval bağımlılığı yok — ChangeRequest burada yalnızca okunur).
 */
export async function stageClosedResults(): Promise<StagedResult[]> {
  const closed = await db.election.findMany({
    where: { status: "CLOSED" },
    select: { id: true, universityId: true, clubId: true, createdById: true },
  });
  const out: StagedResult[] = [];
  for (const e of closed) {
    const already = await db.changeRequest.findFirst({ where: { type: "ELECTION_RESULT", targetId: e.id }, select: { id: true } });
    if (already) continue;
    const candidates = await db.candidate.findMany({ where: { electionId: e.id, approved: true }, select: { id: true, userId: true } });
    const votes = await db.vote.findMany({ where: { electionId: e.id }, select: { candidateId: true } });
    const result = tally(
      candidates.map((c) => c.id),
      votes.map((v) => v.candidateId),
    );
    const winner = result.winnerId ? candidates.find((c) => c.id === result.winnerId)?.userId ?? null : null;
    out.push({ electionId: e.id, universityId: e.universityId, clubId: e.clubId, createdById: e.createdById, winnerUserId: winner, tie: result.tie, counts: result.counts, totalBallots: votes.length });
  }
  return out;
}

export async function markResultPending(electionId: string): Promise<void> {
  await db.election.updateMany({ where: { id: electionId, status: "CLOSED" }, data: { status: "RESULT_PENDING" } });
}

/** Onay handler'ı (approval → election, tek yönlü): sonucu uygula/iptal et. */
export async function finalizeElection(tx: Tx, electionId: string, winnerUserId: string | null): Promise<void> {
  await tx.election.updateMany({ where: { id: electionId, status: "RESULT_PENDING" }, data: { status: "FINALIZED", winnerUserId } });
}

export async function voidElectionResult(tx: Tx, electionId: string): Promise<void> {
  await tx.election.updateMany({ where: { id: electionId, status: "RESULT_PENDING" }, data: { status: "CANCELLED" } });
}
