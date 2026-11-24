import { describe, expect, it } from "vitest";

import { computeFfaStandings, generateFfaHeats, scoreFfaHeat } from "./ffa";
import type { DomainParticipant } from "./types";

const players = (n: number): DomainParticipant[] => Array.from({ length: n }, (_, i) => ({ index: i, seed: i + 1 }));

describe("generateFfaHeats", () => {
  it("12 katılımcı, heatSize 4 → 3 heat, roster birleşimi tam 12", () => {
    const heats = generateFfaHeats(players(12), { heatSize: 4 });
    expect(heats).toHaveLength(3);
    for (const h of heats) expect(h.participantIndexes).toHaveLength(4);
    const union = new Set(heats.flatMap((h) => h.participantIndexes!));
    expect(union.size).toBe(12);
  });

  it("heatSize'a tam bölünmeyen katılımcı sayısında son heat küçük olur", () => {
    const heats = generateFfaHeats(players(10), { heatSize: 4 });
    expect(heats).toHaveLength(3);
    expect(heats[2]!.participantIndexes).toHaveLength(2);
  });
});

describe("scoreFfaHeat", () => {
  const table = { byRank: [10, 8, 6, 5] };

  it("puan tablosuyla rank'a göre doğru puan atar", () => {
    const results = scoreFfaHeat(
      [
        { participantIndex: 0, rank: 1 },
        { participantIndex: 1, rank: 2 },
        { participantIndex: 2, rank: 3 },
        { participantIndex: 3, rank: 4 },
      ],
      table,
    );
    expect(results.map((r) => r.points)).toEqual([10, 8, 6, 5]);
  });

  it("time bazlı heat'te (points zaten tanımsız ama table verilmemişse) tabloya dokunmaz", () => {
    const results = scoreFfaHeat([{ participantIndex: 0, rank: 1, time: 12.3 }]);
    expect(results[0]!.points).toBeUndefined();
    expect(results[0]!.time).toBe(12.3);
  });

  it("points önceden doldurulmuşsa tabloyu uygulamaz", () => {
    const results = scoreFfaHeat([{ participantIndex: 0, rank: 1, points: 99 }], table);
    expect(results[0]!.points).toBe(99);
  });
});

describe("computeFfaStandings", () => {
  it("iki heat üzerinden doğru toplam puan ve played", () => {
    const heats = [
      { results: [{ participantIndex: 0, rank: 1, points: 10 }, { participantIndex: 1, rank: 2, points: 8 }] },
      { results: [{ participantIndex: 0, rank: 2, points: 8 }, { participantIndex: 1, rank: 1, points: 10 }] },
    ];
    const standings = computeFfaStandings(heats);
    const p0 = standings.find((r) => r.index === 0)!;
    const p1 = standings.find((r) => r.index === 1)!;
    expect(p0.points).toBe(18);
    expect(p0.played).toBe(2);
    expect(p0.wins).toBe(1);
    expect(p1.points).toBe(18);
    expect(p1.wins).toBe(1);
  });
});
