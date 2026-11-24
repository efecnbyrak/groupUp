/**
 * Çift eleme braketi (TOURNAMENTS.md §2.2). Saf fonksiyonlar, framework/DB bağımsız.
 * Üst braket (WINNERS) + alt braket (LOSERS) + büyük final (FINAL). Üst braketin r. turunda
 * kaybedenler alt braketin uygun turuna düşer (çapraz/ofset eşleştirme ile erken rövanş azaltılır).
 */
import { generateSingleElimination, nextPowerOfTwo } from "./single-elimination";
import type { NextRef, PlannedMatch } from "./types";
import type { DomainParticipant, MatchPlan } from "./types";

export interface DoubleEliminationOptions {
  /** Büyük final: alt braketten gelen kazanırsa ikinci final (reset maçı) oynanır. */
  grandFinalReset?: boolean;
}

interface SurvivorSource {
  match: PlannedMatch;
  kind: "loserNext" | "next";
}

function setPointer(source: SurvivorSource, ref: NextRef): void {
  if (source.kind === "loserNext") source.match.loserNext = ref;
  else source.match.next = ref;
}

/** Listeyi ofsetli (çapraz) ikili gruplara ayırır; tek sayıda ise son eleman "leftover" olarak döner (bir üst tura doğrudan geçer, LB'de maç oynamaz — bye). */
function pairWithLeftover<T>(list: T[]): { pairs: [T, T][]; leftover?: T } {
  const half = Math.floor(list.length / 2);
  const pairs: [T, T][] = [];
  for (let i = 0; i < half; i++) pairs.push([list[i]!, list[i + half]!]);
  const leftover = list.length % 2 === 1 ? list[list.length - 1] : undefined;
  return { pairs, leftover };
}

export function generateDoubleElimination(participants: DomainParticipant[], opts: DoubleEliminationOptions = {}): MatchPlan {
  const n = participants.length;
  if (n <= 1) return { rounds: 0, matches: [] };

  if (n === 2) {
    // Trivial: tek WB maçı, kaybeden doğrudan büyük finale düşer (LB maçı yok).
    const wb = generateSingleElimination(participants, {});
    const wbFinal = wb.matches[0]!;
    wbFinal.side = "WINNERS";
    const finalRound = 2;
    wbFinal.next = { round: finalRound, position: 0, slot: "home" };
    wbFinal.loserNext = { round: finalRound, position: 0, slot: "away" };
    const matches: PlannedMatch[] = [wbFinal, { round: finalRound, position: 0, groupKey: "GRAND_FINAL", side: "FINAL", homeIndex: null, awayIndex: null, status: "PENDING" }];
    let rounds = finalRound;
    if (opts.grandFinalReset) {
      matches.push({ round: finalRound + 1, position: 0, groupKey: "GRAND_FINAL_RESET", side: "FINAL", homeIndex: null, awayIndex: null, status: "PENDING" });
      rounds = finalRound + 1;
    }
    return { rounds, matches };
  }

  const size = nextPowerOfTwo(n);
  const k = Math.log2(size);

  const wb = generateSingleElimination(participants, {});
  for (const m of wb.matches) m.side = "WINNERS";
  const matches: PlannedMatch[] = [...wb.matches];
  const wbByRound = (r: number) => matches.filter((m) => m.round === r && m.side === "WINNERS" && !m.groupKey).sort((a, b) => a.position - b.position);

  let lbRoundNo = 1;
  const lbMatches: PlannedMatch[] = [];

  // Round 1: WB round-1 kaybedenleri birbiriyle eşleşir (byes hariç gerçek kaybeden üretmeyenler elenir).
  const wbR1Losers: SurvivorSource[] = wbByRound(1)
    .filter((m) => m.status !== "BYE")
    .map((match) => ({ match, kind: "loserNext" as const }));

  let survivors: SurvivorSource[] = [];
  if (wbR1Losers.length > 0) {
    const { pairs, leftover } = pairWithLeftover(wbR1Losers);
    const roundMatches: PlannedMatch[] = pairs.map((pair, i) => {
      const lb: PlannedMatch = { round: lbRoundNo, position: i, side: "LOSERS", homeIndex: null, awayIndex: null, status: "PENDING" };
      setPointer(pair[0], { round: lbRoundNo, position: i, slot: "home" });
      setPointer(pair[1], { round: lbRoundNo, position: i, slot: "away" });
      return lb;
    });
    lbMatches.push(...roundMatches);
    survivors = roundMatches.map((m) => ({ match: m, kind: "next" as const }));
    if (leftover) survivors.push(leftover);
    lbRoundNo++;
  }

  for (let r = 2; r <= k; r++) {
    const wbLosers = wbByRound(r)
      .filter((m) => m.status !== "BYE")
      .map((match) => ({ match, kind: "loserNext" as const }) satisfies SurvivorSource)
      .reverse(); // ofsetli yerleşim: en son WB kaybedeni en erken LB hayatta kalanla eşleşir
    if (wbLosers.length === 0 && survivors.length === 0) continue;

    const dropInCount = Math.max(survivors.length, wbLosers.length);
    const dropInMatches: PlannedMatch[] = [];
    for (let i = 0; i < dropInCount; i++) {
      const lb: PlannedMatch = { round: lbRoundNo, position: i, side: "LOSERS", homeIndex: null, awayIndex: null, status: "PENDING" };
      const survivor = survivors[i];
      const loserSource = wbLosers[i];
      if (survivor) setPointer(survivor, { round: lbRoundNo, position: i, slot: "home" });
      if (loserSource) setPointer(loserSource, { round: lbRoundNo, position: i, slot: "away" });
      dropInMatches.push(lb);
    }
    lbMatches.push(...dropInMatches);
    lbRoundNo++;
    survivors = dropInMatches.map((m) => ({ match: m, kind: "next" as const }));

    if (r < k && survivors.length > 1) {
      const { pairs, leftover } = pairWithLeftover(survivors);
      const nextRoundMatches: PlannedMatch[] = pairs.map((pair, i) => {
        const lb: PlannedMatch = { round: lbRoundNo, position: i, side: "LOSERS", homeIndex: null, awayIndex: null, status: "PENDING" };
        setPointer(pair[0], { round: lbRoundNo, position: i, slot: "home" });
        setPointer(pair[1], { round: lbRoundNo, position: i, slot: "away" });
        return lb;
      });
      lbMatches.push(...nextRoundMatches);
      survivors = nextRoundMatches.map((m) => ({ match: m, kind: "next" as const }));
      if (leftover) survivors.push(leftover);
      lbRoundNo++;
    }
  }

  matches.push(...lbMatches);

  const wbFinal = wbByRound(k)[0]!;
  const finalRound = lbRoundNo + 1;
  const grandFinal: PlannedMatch = { round: finalRound, position: 0, groupKey: "GRAND_FINAL", side: "FINAL", homeIndex: null, awayIndex: null, status: "PENDING" };
  wbFinal.next = { round: finalRound, position: 0, slot: "home" };
  const lbChampion = survivors[0];
  if (lbChampion) setPointer(lbChampion, { round: finalRound, position: 0, slot: "away" });
  matches.push(grandFinal);

  let rounds = finalRound;
  if (opts.grandFinalReset) {
    matches.push({ round: finalRound + 1, position: 0, groupKey: "GRAND_FINAL_RESET", side: "FINAL", homeIndex: null, awayIndex: null, status: "PENDING" });
    rounds = finalRound + 1;
  }

  return { rounds, matches };
}
