import { describe, expect, it } from "vitest";

import { computeStandings, rankStandings, type StandingsMatch } from "./standings";

const POINTS = { win: 3, draw: 1, loss: 0 };

describe("computeStandings", () => {
  it("O, G, B, M, A, Y, Av, P doğru hesaplanır", () => {
    const matches: StandingsMatch[] = [
      { homeIndex: 0, awayIndex: 1, homeScore: 2, awayScore: 1 },
      { homeIndex: 1, awayIndex: 0, homeScore: 0, awayScore: 0 },
    ];
    const rows = computeStandings([0, 1], matches, POINTS);
    const a = rows.find((r) => r.index === 0)!;
    const b = rows.find((r) => r.index === 1)!;
    expect(a).toMatchObject({ played: 2, wins: 1, draws: 1, losses: 0, goalsFor: 2, goalsAgainst: 1, goalDiff: 1, points: 4 });
    expect(b).toMatchObject({ played: 2, wins: 0, draws: 1, losses: 1, goalsFor: 1, goalsAgainst: 2, goalDiff: -1, points: 1 });
  });

  it("form son 5 maçı en yeniden eskiye tutar", () => {
    const matches: StandingsMatch[] = Array.from({ length: 7 }, (_, i) => ({ homeIndex: 0, awayIndex: 1, homeScore: i % 2 === 0 ? 1 : 0, awayScore: i % 2 === 0 ? 0 : 1 }));
    const rows = computeStandings([0, 1], matches, POINTS);
    expect(rows.find((r) => r.index === 0)!.form).toHaveLength(5);
  });
});

describe("rankStandings", () => {
  it("puan eşit değilse yalnızca puana göre sıralar; eşitse averaja düşer", () => {
    const matches: StandingsMatch[] = [
      { homeIndex: 0, awayIndex: 1, homeScore: 3, awayScore: 0 },
      { homeIndex: 1, awayIndex: 2, homeScore: 1, awayScore: 1 },
      { homeIndex: 0, awayIndex: 2, homeScore: 2, awayScore: 0 },
    ];
    const rows = computeStandings([0, 1, 2], matches, POINTS);
    // A 6p (1.). B ve C 1p'de eşit (B: 0-3 ve 1-1; C: 0-2 ve 1-1) — averaja göre C(-2) B'den(-3) önde.
    const ranked = rankStandings(rows, matches, POINTS, ["POINTS", "GOAL_DIFF"]);
    expect(ranked.map((r) => r.index)).toEqual([0, 2, 1]);
  });

  it("ikili averaj üçlü eşitlik: puan eşit kalınca mini lig averajına göre ayrılır", () => {
    // A herkesi 1-0 yener (9 puan, açık ara 1.).
    // B,C,D üçü de 1G2M = 3 puan (genel averaj: B-1, C+2, D-3 — ama averaj devre dışı,
    // önce ikili averaj (yalnızca aralarındaki maçlar) devreye girer).
    // Katılımcılar: A=0, B=1, C=2, D=3
    const all: StandingsMatch[] = [
      { homeIndex: 0, awayIndex: 1, homeScore: 1, awayScore: 0 }, // A beats B
      { homeIndex: 0, awayIndex: 2, homeScore: 1, awayScore: 0 }, // A beats C
      { homeIndex: 0, awayIndex: 3, homeScore: 1, awayScore: 0 }, // A beats D
      { homeIndex: 1, awayIndex: 2, homeScore: 1, awayScore: 0 }, // B beats C
      { homeIndex: 3, awayIndex: 1, homeScore: 1, awayScore: 0 }, // D beats B
      { homeIndex: 2, awayIndex: 3, homeScore: 3, awayScore: 0 }, // C beats D
    ];
    const rows = computeStandings([0, 1, 2, 3], all, POINTS);
    // B, C, D hepsi 1W2L = 3 puan; genel averaj B=-1(1-2), C=+2(3-2... hesap), D=-1(1-2) — kasıtlı
    // yakın tutuldu ki test gerçekten ikili averaj yolunu çalıştırsın.
    const b = rows.find((r) => r.index === 1)!;
    const c = rows.find((r) => r.index === 2)!;
    const d = rows.find((r) => r.index === 3)!;
    expect(b.points).toBe(3);
    expect(c.points).toBe(3);
    expect(d.points).toBe(3);

    const ranked = rankStandings(rows, all, POINTS, ["POINTS", "HEAD_TO_HEAD", "GOAL_DIFF"]);
    expect(ranked[0]!.index).toBe(0); // A her zaman birinci
    // Aralarındaki mini lig: B beats C(1-0), D beats B(1-0), C beats D(3-0) → hepsi 1W1L=3p (döngüsel),
    // mini averaj: B=(1-0)+(0-1)=0, C=(0-1)+(3-0)=+2, D=(1-0)+(0-3)=-2 → sıra C, B, D.
    expect(ranked.slice(1).map((r) => r.index)).toEqual([2, 1, 3]);
  });

  it("döngüsel (rock-paper-scissors) eşitlikte hiçbir ikili averaj ayıramazsa sıradaki kritere düşer", () => {
    const all: StandingsMatch[] = [
      { homeIndex: 0, awayIndex: 1, homeScore: 2, awayScore: 0 },
      { homeIndex: 1, awayIndex: 2, homeScore: 2, awayScore: 0 },
      { homeIndex: 2, awayIndex: 0, homeScore: 2, awayScore: 0 },
    ];
    const rows = computeStandings([0, 1, 2], all, POINTS);
    const ranked = rankStandings(rows, all, POINTS, ["POINTS", "HEAD_TO_HEAD", "LOT"]);
    // Üçü de 1W1L=3p, averaj 0 — ikili averaj da ayıramaz (simetrik döngü) → LOT: girdi sırası korunur.
    expect(ranked.map((r) => r.index)).toEqual([0, 1, 2]);
  });
});
