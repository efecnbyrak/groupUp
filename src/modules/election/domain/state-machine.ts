/**
 * Seçim durum makinesi (ELECTIONS.md §1) — saf, framework bağımsız, unit test edilir.
 * Zaman tabanlı geçişler yalnızca DRAFT→CANDIDACY→VOTING→CLOSED; RESULT_PENDING→FINALIZED/CANCELLED
 * Admin kararıyla (onay motoru) olur, burada hesaplanmaz.
 */

export type TimeDrivenStatus = "DRAFT" | "CANDIDACY" | "VOTING" | "CLOSED";

export interface ElectionWindow {
  candidacyOpensAt: Date;
  candidacyClosesAt: Date;
  votingOpensAt: Date;
  votingClosesAt: Date;
}

/** Tarih sırası: candidacyOpensAt < candidacyClosesAt <= votingOpensAt < votingClosesAt. */
export function validateWindow(w: ElectionWindow): boolean {
  return w.candidacyOpensAt.getTime() < w.candidacyClosesAt.getTime() && w.candidacyClosesAt.getTime() <= w.votingOpensAt.getTime() && w.votingOpensAt.getTime() < w.votingClosesAt.getTime();
}

/**
 * `now`'a göre olması gereken zaman tabanlı durum. `status` DRAFT/CANDIDACY/VOTING değilse
 * (CLOSED sonrası Admin akışına geçmiş) `null` döner — artık zamanla sürülmez.
 */
export function deriveTimeStatus(status: string, w: ElectionWindow, now: Date): TimeDrivenStatus | null {
  if (status !== "DRAFT" && status !== "CANDIDACY" && status !== "VOTING") return null;
  const t = now.getTime();
  if (t < w.candidacyOpensAt.getTime()) return "DRAFT";
  if (t < w.votingOpensAt.getTime()) return "CANDIDACY";
  if (t < w.votingClosesAt.getTime()) return "VOTING";
  return "CLOSED";
}

/** Adaylık penceresi açık mı (candidacyOpensAt ≤ now < candidacyClosesAt). */
export function isCandidacyWindowOpen(w: ElectionWindow, now: Date): boolean {
  return now.getTime() >= w.candidacyOpensAt.getTime() && now.getTime() < w.candidacyClosesAt.getTime();
}

/** Oy penceresi açık mı. */
export function isVotingWindowOpen(w: ElectionWindow, now: Date): boolean {
  return now.getTime() >= w.votingOpensAt.getTime() && now.getTime() < w.votingClosesAt.getTime();
}

export interface TallyResult {
  /** Aday id → oy sayısı (tek adaylıkta "NO" anahtarı Hayır oylarını taşır). */
  counts: Record<string, number>;
  winnerId: string | null;
  tie: boolean;
}

/** `votes`: her oy verenin seçtiği candidateId; tek adaylıkta "NO" özel değeri Hayır demektir. */
export function tally(candidateIds: readonly string[], votes: readonly string[]): TallyResult {
  const counts: Record<string, number> = {};
  for (const id of candidateIds) counts[id] = 0;
  if (candidateIds.length === 1) counts.NO = 0;
  for (const v of votes) counts[v] = (counts[v] ?? 0) + 1;

  if (candidateIds.length === 0) return { counts, winnerId: null, tie: false };

  if (candidateIds.length === 1) {
    const [id] = candidateIds;
    const yes = counts[id] ?? 0;
    const no = counts.NO ?? 0;
    if (yes === no) return { counts, winnerId: null, tie: true };
    return { counts, winnerId: yes > no ? id : null, tie: false };
  }

  let best: string[] = [];
  let bestCount = -1;
  for (const id of candidateIds) {
    const c = counts[id] ?? 0;
    if (c > bestCount) {
      bestCount = c;
      best = [id];
    } else if (c === bestCount) {
      best.push(id);
    }
  }
  if (best.length !== 1) return { counts, winnerId: null, tie: true };
  return { counts, winnerId: best[0], tie: false };
}
