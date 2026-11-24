import { describe, expect, it } from "vitest";

import { generateSingleElimination, nextPowerOfTwo, seedPositions } from "./single-elimination";
import type { DomainParticipant } from "./types";

const players = (n: number): DomainParticipant[] => Array.from({ length: n }, (_, i) => ({ index: i, seed: i + 1 }));

describe("nextPowerOfTwo", () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 4],
    [4, 4],
    [5, 8],
    [8, 8],
    [9, 16],
    [16, 16],
    [17, 32],
    [33, 64],
  ])("n=%i → %i", (n, size) => {
    expect(nextPowerOfTwo(n)).toBe(size);
  });
});

describe("seedPositions", () => {
  it("klasik 8'lik braket sırası", () => {
    expect(seedPositions(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
  it("her boyutta her tohum tam bir kez geçer", () => {
    for (const size of [2, 4, 8, 16, 32, 64]) {
      const pos = seedPositions(size);
      expect(pos).toHaveLength(size);
      expect(new Set(pos).size).toBe(size);
      expect(Math.max(...pos)).toBe(size);
    }
  });
});

describe("generateSingleElimination", () => {
  it("n=0 ve n=1: maç yok", () => {
    expect(generateSingleElimination([])).toEqual({ rounds: 0, matches: [] });
    expect(generateSingleElimination(players(1))).toEqual({ rounds: 0, matches: [] });
  });

  it.each([2, 3, 5, 8, 13, 16, 33])("n=%i: oynanacak (PENDING) maç sayısı n-1, bye sayısı doğru", (n) => {
    const plan = generateSingleElimination(players(n));
    const size = 2 ** Math.ceil(Math.log2(n));
    const expectedByes = size - n;
    const all = plan.matches.filter((m) => !m.groupKey);
    const pending = all.filter((m) => m.status === "PENDING");
    const byes = all.filter((m) => m.status === "BYE");
    // Her gerçek maç tam bir katılımcıyı eler; n katılımcıdan 1 şampiyon çıkması için n-1 gerçek maç gerekir.
    expect(pending).toHaveLength(n - 1);
    expect(byes).toHaveLength(expectedByes);
    expect(all).toHaveLength(size - 1);
    // Bye'lar yalnızca 1. turda.
    expect(byes.every((m) => m.round === 1)).toBe(true);
  });

  it("1. ve 2. tohum yalnızca finalde karşılaşabilir (n=2..64)", () => {
    for (let n = 2; n <= 64; n++) {
      const plan = generateSingleElimination(players(n));
      const finalRound = plan.rounds;
      // Katılımcı index 0 = tohum 1, index 1 = tohum 2 (players() sırayla tohumlar).
      for (const m of plan.matches.filter((x) => !x.groupKey)) {
        const has1 = m.homeIndex === 0 || m.awayIndex === 0;
        const has2 = m.homeIndex === 1 || m.awayIndex === 1;
        if (has1 && has2 && m.round !== 1) {
          // Aynı maçta ikisi de varsa (ör. n=2) ya ilk tur ya final olmalı.
          expect(m.round === finalRound || n === 2).toBe(true);
        }
      }
    }
  });

  it("bye kazananı sonraki tura otomatik taşınır (n=3)", () => {
    const plan = generateSingleElimination(players(3));
    // size=4, round1: (seed1 vs BYE), (seed2 vs seed3); round2 final: seed1 vs kazanan(2,3)
    const r1 = plan.matches.filter((m) => m.round === 1);
    const bye = r1.find((m) => m.status === "BYE")!;
    expect(bye.byeWinnerIndex).toBe(0); // seed1 => index 0
    const final = plan.matches.find((m) => m.round === 2)!;
    expect(final.homeIndex === 0 || final.awayIndex === 0).toBe(true);
    // Diğer taraf henüz belli değil (TBD).
    expect(final.homeIndex === null || final.awayIndex === null).toBe(true);
  });

  it("3.lük maçı: yarı final kaybedenleri ayrı maça bağlanır", () => {
    const plan = generateSingleElimination(players(8), { thirdPlaceMatch: true });
    const third = plan.matches.find((m) => m.groupKey === "THIRD_PLACE")!;
    expect(third).toBeTruthy();
    const semis = plan.matches.filter((m) => m.round === plan.rounds - 1 && !m.groupKey);
    expect(semis).toHaveLength(2);
    expect(semis[0]!.loserNext).toEqual({ round: plan.rounds, position: 1, slot: "home" });
    expect(semis[1]!.loserNext).toEqual({ round: plan.rounds, position: 1, slot: "away" });
  });

  it("sıralama seed alanına göre yapılır, girdi sırasına değil", () => {
    const shuffled: DomainParticipant[] = [
      { index: 10, seed: 3 },
      { index: 20, seed: 1 },
      { index: 30, seed: 2 },
      { index: 40, seed: 4 },
    ];
    const plan = generateSingleElimination(shuffled);
    const r1 = plan.matches.filter((m) => m.round === 1);
    // seed1 (index 20) ve seed4 (index 40) eşleşir; seed2 (30) ve seed3 (10) eşleşir — klasik 1v4, 2v3 sırası boyut 4'te.
    const pairs = r1.map((m) => new Set([m.homeIndex, m.awayIndex]));
    expect(pairs.some((p) => p.has(20) && p.has(40))).toBe(true);
    expect(pairs.some((p) => p.has(30) && p.has(10))).toBe(true);
  });
});
