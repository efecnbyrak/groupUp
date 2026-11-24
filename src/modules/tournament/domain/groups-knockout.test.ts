import { describe, expect, it } from "vitest";

import { assignGroups, seedKnockoutFromGroups } from "./groups-knockout";
import { generateSingleElimination } from "./single-elimination";
import type { DomainParticipant } from "./types";

const players = (n: number): DomainParticipant[] => Array.from({ length: n }, (_, i) => ({ index: i, seed: i + 1 }));

describe("assignGroups", () => {
  it("yılan tohumlama: her grup eşit boyutta, üst tohumlar ayrı gruplara dağılır", () => {
    const groups = assignGroups(players(16), 4);
    expect(groups).toHaveLength(4);
    for (const g of groups) expect(g.participants).toHaveLength(4);
    // Tohum 1-4 (index 0-3) dört ayrı grupta olmalı (ilk tur yılan dağıtımı).
    const topSeedGroups = groups.map((g) => g.participants.find((p) => p.index < 4));
    expect(new Set(topSeedGroups.map((_p, i) => i)).size).toBe(4);
    for (const g of groups) expect(g.participants.filter((p) => p.index < 4)).toHaveLength(1);
  });

  it("tüm katılımcılar tam bir kez bir gruba atanır", () => {
    const groups = assignGroups(players(13), 3);
    const all = groups.flatMap((g) => g.participants.map((p) => p.index));
    expect(new Set(all).size).toBe(13);
    expect(groups.map((g) => g.participants.length).sort()).toEqual([4, 4, 5]);
  });
});

describe("seedKnockoutFromGroups", () => {
  it("2 grup × 2 çıkan: çapraz eşleşme A1-B2, B1-A2 (aynı gruptan finale kadar karşılaşmaz)", () => {
    const groups = [
      { groupKey: "A", rankedIndexes: [0, 1] }, // A1=0, A2=1
      { groupKey: "B", rankedIndexes: [2, 3] }, // B1=2, B2=3
    ];
    const seeded = seedKnockoutFromGroups(groups, 2);
    // Tier0 (1.ler): A1(seed1), B1(seed2). Tier1 (2.ler): A2(seed3), B2(seed4).
    expect(seeded).toEqual([
      { index: 0, seed: 1 },
      { index: 2, seed: 2 },
      { index: 1, seed: 3 },
      { index: 3, seed: 4 },
    ]);
    const plan = generateSingleElimination(seeded);
    // size=4, seedPositions=[1,4,2,3]: round1 = (seed1 vs seed4)=(A1 vs B2), (seed2 vs seed3)=(B1 vs A2) — docs §2.4 ile birebir.
    const r1 = plan.matches.filter((m) => m.round === 1);
    const groupOf = (idx: number) => (idx < 2 ? "A" : "B");
    for (const m of r1) {
      if (m.homeIndex !== null && m.awayIndex !== null) expect(groupOf(m.homeIndex)).not.toBe(groupOf(m.awayIndex));
    }
  });

  it("4 grup × 2 çıkan (8 kişi): round1'de hiçbir eşleşme aynı gruptan değil", () => {
    const groups = [
      { groupKey: "A", rankedIndexes: [0, 1] },
      { groupKey: "B", rankedIndexes: [2, 3] },
      { groupKey: "C", rankedIndexes: [4, 5] },
      { groupKey: "D", rankedIndexes: [6, 7] },
    ];
    const groupOf = (idx: number) => groups.find((g) => g.rankedIndexes.includes(idx))!.groupKey;
    const seeded = seedKnockoutFromGroups(groups, 2);
    const plan = generateSingleElimination(seeded);
    for (const m of plan.matches.filter((x) => x.round === 1)) {
      expect(groupOf(m.homeIndex!)).not.toBe(groupOf(m.awayIndex!));
    }
  });

  it("bestThirds: belirtilen grup sırasına göre en iyi 3.ler eklenir", () => {
    const groups = [
      { groupKey: "A", rankedIndexes: [0, 1, 2] },
      { groupKey: "B", rankedIndexes: [3, 4, 5] },
      { groupKey: "C", rankedIndexes: [6, 7, 8] },
      { groupKey: "D", rankedIndexes: [9, 10, 11] },
    ];
    const seeded = seedKnockoutFromGroups(groups, 2, ["C", "A"]);
    // 4 grup × 2 çıkan = 8 doğrudan + en iyi 2 üçüncü (C'nin 3.sü, A'nın 3.sü).
    expect(seeded).toHaveLength(10);
    expect(seeded.slice(8).map((p) => p.index)).toEqual([8, 2]); // C3=index8, A3=index2
  });
});
