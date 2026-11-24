import { describe, expect, it } from "vitest";

import { generateDoubleElimination } from "./double-elimination";
import type { DomainParticipant } from "./types";

const players = (n: number): DomainParticipant[] => Array.from({ length: n }, (_, i) => ({ index: i, seed: i + 1 }));

describe("generateDoubleElimination", () => {
  it("n=0 ve n=1: maç yok", () => {
    expect(generateDoubleElimination([])).toEqual({ rounds: 0, matches: [] });
    expect(generateDoubleElimination(players(1))).toEqual({ rounds: 0, matches: [] });
  });

  it.each([2, 4, 8, 16])("n=%i: reset yoksa toplam maç 2n-2", (n) => {
    const plan = generateDoubleElimination(players(n));
    expect(plan.matches).toHaveLength(2 * n - 2);
  });

  it.each([2, 4, 8, 16])("n=%i: reset varsa toplam maç 2n-1", (n) => {
    const plan = generateDoubleElimination(players(n), { grandFinalReset: true });
    expect(plan.matches).toHaveLength(2 * n - 1);
  });

  it("hiçbir maçta home===away", () => {
    for (const n of [4, 8, 16]) {
      const plan = generateDoubleElimination(players(n));
      for (const m of plan.matches) {
        if (m.homeIndex !== null && m.awayIndex !== null) expect(m.homeIndex).not.toBe(m.awayIndex);
      }
    }
  });

  it("her loserNext hedefi üretilen bir LOSERS/FINAL maçına işaret eder", () => {
    for (const n of [4, 8, 16]) {
      const plan = generateDoubleElimination(players(n));
      const findTarget = (ref: { round: number; position: number }) => plan.matches.find((m) => m.round === ref.round && m.position === ref.position && (m.side === "LOSERS" || m.side === "FINAL"));
      for (const m of plan.matches) {
        if (m.loserNext) expect(findTarget(m.loserNext)).toBeTruthy();
      }
    }
  });

  it("her next hedefi üretilen bir maça işaret eder", () => {
    for (const n of [4, 8, 16]) {
      const plan = generateDoubleElimination(players(n));
      for (const m of plan.matches) {
        if (!m.next) continue;
        const candidates = plan.matches.filter((t) => t.round === m.next!.round && t.position === m.next!.position);
        expect(candidates.length).toBeGreaterThan(0);
      }
    }
  });

  it("WB maçları side=WINNERS, LB maçları side=LOSERS, final side=FINAL", () => {
    const plan = generateDoubleElimination(players(8));
    const grandFinal = plan.matches.find((m) => m.groupKey === "GRAND_FINAL")!;
    expect(grandFinal.side).toBe("FINAL");
    expect(plan.matches.some((m) => m.side === "WINNERS")).toBe(true);
    expect(plan.matches.some((m) => m.side === "LOSERS")).toBe(true);
  });

  it("grandFinalReset: ikinci final maçı GRAND_FINAL_RESET groupKey ile üretilir", () => {
    const plan = generateDoubleElimination(players(8), { grandFinalReset: true });
    const reset = plan.matches.find((m) => m.groupKey === "GRAND_FINAL_RESET");
    expect(reset).toBeTruthy();
    expect(reset!.side).toBe("FINAL");
    expect(reset!.status).toBe("PENDING");
  });

  it("n=8: tam olarak bir büyük final maçı var, WB şampiyonu home'a next ile bağlanır", () => {
    const plan = generateDoubleElimination(players(8));
    const finals = plan.matches.filter((m) => m.groupKey === "GRAND_FINAL");
    expect(finals).toHaveLength(1);
    const wbFinal = plan.matches.find((m) => m.side === "WINNERS" && m.next?.position === finals[0]!.position && m.next.round === finals[0]!.round)!;
    expect(wbFinal).toBeTruthy();
    expect(wbFinal.next!.slot).toBe("home");
  });

  it("bye içeren n için WB bye kazananının next/loserNext'i (varsa) önceden bilgilidir (F8 single-elim deseniyle tutarlı)", () => {
    const plan = generateDoubleElimination(players(5));
    const byes = plan.matches.filter((m) => m.status === "BYE");
    expect(byes.length).toBeGreaterThan(0);
    for (const b of byes) {
      expect(b.byeWinnerIndex).toBeDefined();
    }
  });
});
