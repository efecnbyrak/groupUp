/**
 * Lig (round robin) fikstürü — Berger/circle yöntemi (TOURNAMENTS.md §2.3). Saf fonksiyon.
 */
import type { DomainParticipant, MatchPlan, PlannedMatch } from "./types";

export interface RoundRobinOptions {
  /** Çift devre: ikinci yarıda ev/deplasman ters (tüm maçlar tekrarlanır). */
  doubleRound?: boolean;
}

/**
 * Berger/circle: n tek ise bir "BAY" (bye) sanal katılımcı eklenir (-1 index), n-1 (veya n) tur.
 * Her turda bir sabit katılımcı (0) kalır, diğerleri saat yönünde döner.
 */
export function generateRoundRobin(participants: DomainParticipant[], opts: RoundRobinOptions = {}): MatchPlan {
  const real = [...participants].sort((a, b) => a.seed - b.seed).map((p) => p.index);
  if (real.length < 2) return { rounds: 0, matches: [] };

  const hasBye = real.length % 2 === 1;
  const ring = hasBye ? [...real, -1] : [...real];
  const m = ring.length; // çift
  const roundsPerLeg = m - 1;
  const half = m / 2;

  const matches: PlannedMatch[] = [];
  let current = [...ring];
  for (let r = 0; r < roundsPerLeg; r++) {
    let pos = 0;
    for (let i = 0; i < half; i++) {
      // Dönüşümlü ev/deplasman: tur çiftse düz, tekse ters (Berger ev/dep dengesi).
      const flip = r % 2 === 1;
      const a = current[i]!;
      const b = current[m - 1 - i]!;
      const home = flip ? b : a;
      const away = flip ? a : b;
      if (home === -1 || away === -1) continue; // BAY turu: bu katılımcı o tur dinlenir, maç üretilmez
      matches.push({ round: r + 1, position: pos++, homeIndex: home, awayIndex: away, status: "PENDING" });
    }
    // rotasyon: ilk eleman sabit, geri kalanlar saat yönünde kayar
    current = [current[0]!, current[m - 1]!, ...current.slice(1, m - 1)];
  }

  if (opts.doubleRound) {
    const leg1 = matches.length;
    for (let i = 0; i < leg1; i++) {
      const src = matches[i]!;
      matches.push({ round: roundsPerLeg + src.round, position: src.position, homeIndex: src.awayIndex, awayIndex: src.homeIndex, status: "PENDING" });
    }
  }

  const rounds = opts.doubleRound ? roundsPerLeg * 2 : roundsPerLeg;
  return { rounds, matches };
}
