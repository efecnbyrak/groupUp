import { describe, expect, it } from "vitest";

import { defaultSwissRounds, generateSwissRound, type SwissPlayerState } from "./swiss";

const initial = (n: number): SwissPlayerState[] => Array.from({ length: n }, (_, i) => ({ index: i, points: 0, opponents: [], hadBye: false }));

/** Bir turun sonuçlarını uygulayıp bir sonraki tur için state üretir (ev sahibi her zaman kazanır, bye 1 puan). */
function applyRound(states: SwissPlayerState[], matches: ReturnType<typeof generateSwissRound>): SwissPlayerState[] {
  const byIndex = new Map(states.map((s) => [s.index, { ...s, opponents: [...s.opponents] }]));
  for (const m of matches) {
    if (m.status === "BYE") {
      const p = byIndex.get(m.byeWinnerIndex!)!;
      p.points += 1;
      p.hadBye = true;
      continue;
    }
    const home = byIndex.get(m.homeIndex!)!;
    const away = byIndex.get(m.awayIndex!)!;
    home.points += 1; // ev sahibi kazanır (deterministik simülasyon)
    home.opponents.push(away.index);
    away.opponents.push(home.index);
  }
  return [...byIndex.values()];
}

describe("defaultSwissRounds", () => {
  it.each([
    [2, 1],
    [8, 3],
    [16, 4],
  ])("n=%i → %i tur", (n, expected) => {
    expect(defaultSwissRounds(n)).toBe(expected);
  });
});

describe("generateSwissRound", () => {
  it("hiçbir ikili iki kez eşleşmez (5 turluk simülasyon, n=16 çift)", () => {
    let states = initial(16);
    const seenPairs = new Set<string>();
    for (let round = 1; round <= 5; round++) {
      const matches = generateSwissRound(states, { roundNumber: round });
      for (const m of matches) {
        if (m.status === "BYE") continue;
        const key = m.homeIndex! < m.awayIndex! ? `${m.homeIndex}-${m.awayIndex}` : `${m.awayIndex}-${m.homeIndex}`;
        expect(seenPairs.has(key)).toBe(false);
        seenPairs.add(key);
      }
      states = applyRound(states, matches);
    }
  });

  it("tek sayıda katılımcıda her turda tam bir bye var; 5 tur boyunca ilk 5 bye farklı kişiye gider (n=5)", () => {
    let states = initial(5);
    const byeRecipients: number[] = [];
    for (let round = 1; round <= 5; round++) {
      const matches = generateSwissRound(states, { roundNumber: round });
      const byes = matches.filter((m) => m.status === "BYE");
      expect(byes).toHaveLength(1);
      byeRecipients.push(byes[0]!.byeWinnerIndex!);
      states = applyRound(states, matches);
    }
    expect(new Set(byeRecipients).size).toBe(5); // 5 farklı kişi bye almadan tekrar bye verilmedi
  });

  it("çakışmasız fixture'da üst-yarı/alt-yarı eşleşmesi beklenen şekilde", () => {
    // Hiç geçmiş yok, hepsi 0 puan → index sırasına göre üst yarı [0,1,2,3] vs alt yarı [4,5,6,7].
    const states = initial(8);
    const matches = generateSwissRound(states, { roundNumber: 1 });
    const pairs = matches.map((m) => new Set([m.homeIndex, m.awayIndex]));
    expect(pairs.some((p) => p.has(0) && p.has(4))).toBe(true);
    expect(pairs.some((p) => p.has(1) && p.has(5))).toBe(true);
    expect(pairs.some((p) => p.has(2) && p.has(6))).toBe(true);
    expect(pairs.some((p) => p.has(3) && p.has(7))).toBe(true);
  });
});
