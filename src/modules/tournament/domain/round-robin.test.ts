import { describe, expect, it } from "vitest";

import { generateRoundRobin } from "./round-robin";
import type { DomainParticipant } from "./types";

const players = (n: number): DomainParticipant[] => Array.from({ length: n }, (_, i) => ({ index: i, seed: i + 1 }));
const pairKey = (a: number, b: number) => [a, b].sort((x, y) => x - y).join("-");

describe("generateRoundRobin", () => {
  it("n<2: maç yok", () => {
    expect(generateRoundRobin([])).toEqual({ rounds: 0, matches: [] });
    expect(generateRoundRobin(players(1))).toEqual({ rounds: 0, matches: [] });
  });

  it.each([4, 5, 6, 7, 8, 9, 10])("n=%i: her çift tam bir kez karşılaşır, kimse aynı turda iki kez oynamaz", (n) => {
    const plan = generateRoundRobin(players(n));
    const expectedMatches = (n * (n - 1)) / 2;
    expect(plan.matches).toHaveLength(expectedMatches);

    const seen = new Set<string>();
    for (const m of plan.matches) {
      const key = pairKey(m.homeIndex!, m.awayIndex!);
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe(expectedMatches);

    const byRound = new Map<number, Set<number>>();
    for (const m of plan.matches) {
      const set = byRound.get(m.round) ?? new Set<number>();
      expect(set.has(m.homeIndex!)).toBe(false);
      expect(set.has(m.awayIndex!)).toBe(false);
      set.add(m.homeIndex!);
      set.add(m.awayIndex!);
      byRound.set(m.round, set);
    }

    const expectedRounds = n % 2 === 0 ? n - 1 : n;
    expect(plan.rounds).toBe(expectedRounds);
  });

  it("çift devre: her çift iki kez (ev/dep ters), tur sayısı iki katı", () => {
    const n = 6;
    const plan = generateRoundRobin(players(n), { doubleRound: true });
    expect(plan.matches).toHaveLength(n * (n - 1));
    expect(plan.rounds).toBe((n - 1) * 2);

    const counts = new Map<string, { count: number; homes: Set<number> }>();
    for (const m of plan.matches) {
      const key = pairKey(m.homeIndex!, m.awayIndex!);
      const entry = counts.get(key) ?? { count: 0, homes: new Set<number>() };
      entry.count++;
      entry.homes.add(m.homeIndex!);
      counts.set(key, entry);
    }
    for (const entry of counts.values()) {
      expect(entry.count).toBe(2);
      expect(entry.homes.size).toBe(2); // ikinci devrede ev sahipliği ters
    }
  });

  it("tek sayıda katılımcıda BAY turu kimseyi iki kez oynatmaz (n=5)", () => {
    const plan = generateRoundRobin(players(5));
    expect(plan.rounds).toBe(5);
    for (let r = 1; r <= 5; r++) {
      const inRound = plan.matches.filter((m) => m.round === r);
      expect(inRound).toHaveLength(2); // 5 kişiden 4'ü oynar, 1'i dinlenir
    }
  });
});
