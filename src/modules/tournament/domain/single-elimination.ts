/**
 * Tek eleme braketi (TOURNAMENTS.md §2.1). Saf fonksiyonlar, framework/DB bağımsız.
 */
import type { DomainParticipant, MatchPlan, NextRef, PlannedMatch } from "./types";

export function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  return 2 ** Math.ceil(Math.log2(n));
}

/**
 * Standart braket tohum sırası: `size` uzunluğunda, slot başına tohum numarası (1 tabanlı).
 * Üst tohumlar yalnızca finalde karşılaşır (1 vs 2 ancak son maçta). Yinelemeli ikiye katlama:
 * size=2 → [1,2]; size=4 → [1,4,2,3]; size=8 → [1,8,4,5,2,7,3,6]; …
 */
export function seedPositions(size: number): number[] {
  if (size <= 1) return [1];
  let positions = [1, 2];
  while (positions.length < size) {
    const sum = positions.length * 2 + 1;
    const next: number[] = [];
    for (const p of positions) next.push(p, sum - p);
    positions = next;
  }
  return positions;
}

export interface SingleEliminationOptions {
  /** 3.lük maçı oynanacak mı (yarı final kaybedenleri). */
  thirdPlaceMatch?: boolean;
  /** İki maçlı eşleşme (toplam skor) — final hariç tüm turlar. */
  twoLegged?: boolean;
  /** İki maçlı final — `twoLegged` kapalıyken de tek başına final için geçerli olabilir. */
  twoLeggedFinal?: boolean;
}

/**
 * `participants` tohuma göre artan sırada OLMAK ZORUNDA DEĞİL — `seed` alanına göre sıralanır.
 * n=0 → boş plan, n=1 → şampiyon doğrudan belli (0 maç).
 */
export function generateSingleElimination(participants: DomainParticipant[], opts: SingleEliminationOptions = {}): MatchPlan {
  const n = participants.length;
  if (n <= 1) return { rounds: 0, matches: [] };

  const sorted = [...participants].sort((a, b) => a.seed - b.seed);
  const size = nextPowerOfTwo(n);
  const rounds = Math.log2(size);
  const positions = seedPositions(size);
  // slot -> katılımcı index'i (sorted dizisindeki index'in gerçek index'ine çevrilir) veya null (bye)
  const slotIndex: (number | null)[] = positions.map((seedNo) => (seedNo <= n ? sorted[seedNo - 1]!.index : null));

  const matches: PlannedMatch[] = [];
  // round 1
  const round1Count = size / 2;
  // round1 maçının ürettiği "bilinen katılımcı" (bye kazananı) — round2'nin ilgili slotuna doğrudan yerleşir.
  const round1Winner: (number | null)[] = new Array(round1Count).fill(null);
  for (let i = 0; i < round1Count; i++) {
    const home = slotIndex[2 * i]!;
    const away = slotIndex[2 * i + 1]!;
    const isBye = home === null || away === null;
    const next: NextRef | undefined = rounds > 1 ? { round: 2, position: Math.floor(i / 2), slot: i % 2 === 0 ? "home" : "away" } : undefined;
    matches.push({
      round: 1,
      position: i,
      homeIndex: home,
      awayIndex: away,
      status: isBye ? "BYE" : "PENDING",
      byeWinnerIndex: isBye ? (home ?? away)! : undefined,
      next,
    });
    if (isBye) round1Winner[i] = (home ?? away)!;
  }

  // round 2..rounds: slotlar round1 bye kazananlarıyla önceden doldurulabilir, diğerleri TBD (null).
  let prevCount = round1Count;
  let prevKnown = round1Winner;
  for (let r = 2; r <= rounds; r++) {
    const count = prevCount / 2;
    const known: (number | null)[] = new Array(count).fill(null);
    for (let i = 0; i < count; i++) {
      const home = prevKnown[2 * i] ?? null;
      const away = prevKnown[2 * i + 1] ?? null;
      const next: NextRef | undefined = r < rounds ? { round: r + 1, position: Math.floor(i / 2), slot: i % 2 === 0 ? "home" : "away" } : undefined;
      matches.push({ round: r, position: i, homeIndex: home, awayIndex: away, status: "PENDING", next });
    }
    prevCount = count;
    prevKnown = known;
  }

  if (opts.twoLegged || opts.twoLeggedFinal) {
    for (const m of matches) {
      if (m.status === "BYE" || m.groupKey) continue;
      const isFinal = m.round === rounds;
      if ((isFinal && opts.twoLeggedFinal) || (!isFinal && opts.twoLegged) || (isFinal && opts.twoLegged)) m.legs = 2;
    }
  }

  if (opts.thirdPlaceMatch && rounds >= 2) {
    matches.push({ round: rounds, position: 1, groupKey: "THIRD_PLACE", homeIndex: null, awayIndex: null, status: "PENDING" });
    // Yarı finaller: round = rounds-1, position 0 ve 1. Kaybedenleri 3.lük maçının home/away'ine bağla.
    const semi0 = matches.find((m) => m.round === rounds - 1 && m.position === 0 && !m.groupKey);
    const semi1 = matches.find((m) => m.round === rounds - 1 && m.position === 1 && !m.groupKey);
    if (semi0) semi0.loserNext = { round: rounds, position: 1, slot: "home" };
    if (semi1) semi1.loserNext = { round: rounds, position: 1, slot: "away" };
  }

  return { rounds, matches };
}
