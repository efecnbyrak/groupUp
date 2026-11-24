import { describe, expect, it } from "vitest";

import { expandSlotTemplates, scheduleGreedy, type SchedulableMatch, type SlotInstance } from "./scheduling";

const CONSTRAINTS = { minRestMin: 30, maxMatchesPerDay: 10 };

describe("expandSlotTemplates", () => {
  it("bir haftalık pencerede bir venue, Cumartesi 10:00-12:00, 30dk → 4 slot", () => {
    // 2026-11-28 Cumartesi (weekday hesaplama: Pzt=0..Paz=6).
    const from = new Date("2026-11-23T00:00:00.000Z");
    const to = new Date("2026-11-30T00:00:00.000Z");
    const slots = expandSlotTemplates([{ venueId: "v1", weekday: 5, startMinute: 600, endMinute: 720, matchMinutes: 30 }], from, to);
    expect(slots).toHaveLength(4);
    expect(slots.every((s) => s.venueId === "v1")).toBe(true);
  });
});

describe("scheduleGreedy", () => {
  function slots(n: number, venueId = "v1", stepMinutes = 30): SlotInstance[] {
    const base = new Date("2026-11-28T10:00:00.000Z");
    return Array.from({ length: n }, (_, i) => {
      const start = new Date(base.getTime() + i * stepMinutes * 60_000);
      const end = new Date(start.getTime() + stepMinutes * 60_000);
      return { venueId, start, end };
    });
  }

  it("yeterli slot varsa hiçbir maç planlanamadı listesine düşmez, çakışma olmaz", () => {
    const matches: SchedulableMatch[] = [
      { id: "m1", round: 1, dependsOn: [], participantIds: ["a", "b"] },
      { id: "m2", round: 1, dependsOn: [], participantIds: ["c", "d"] },
    ];
    const result = scheduleGreedy(matches, slots(4), [], CONSTRAINTS);
    expect(result.unplaced).toHaveLength(0);
    expect(result.placed).toHaveLength(2);
  });

  it("maxMatchesPerDay=1 ile aynı katılımcının 3 maçından sadece 1'i o gün yerleşir", () => {
    const matches: SchedulableMatch[] = [
      { id: "m1", round: 1, dependsOn: [], participantIds: ["a", "b"] },
      { id: "m2", round: 1, dependsOn: [], participantIds: ["a", "c"] },
      { id: "m3", round: 1, dependsOn: [], participantIds: ["a", "d"] },
    ];
    const result = scheduleGreedy(matches, slots(3), [], { minRestMin: 0, maxMatchesPerDay: 1 });
    expect(result.placed).toHaveLength(1);
    expect(result.unplaced).toHaveLength(2);
  });

  it("bağımlılık zinciri: round 2 maçı, round 1 bağımlılığının bitişinden önce başlamaz", () => {
    const matches: SchedulableMatch[] = [
      { id: "m1", round: 1, dependsOn: [], participantIds: ["a", "b"] },
      { id: "m2", round: 2, dependsOn: ["m1"], participantIds: ["a", "c"] },
    ];
    const result = scheduleGreedy(matches, slots(5), [], CONSTRAINTS);
    const m1 = result.placed.find((p) => p.matchId === "m1")!;
    const m2 = result.placed.find((p) => p.matchId === "m2")!;
    expect(m2.start.getTime()).toBeGreaterThanOrEqual(m1.start.getTime() + 30 * 60_000);
  });

  it("minRestMin saygı duyulur: aynı katılımcının iki maçı arasında en az minRestMin olur", () => {
    const matches: SchedulableMatch[] = [
      { id: "m1", round: 1, dependsOn: [], participantIds: ["a", "b"] },
      { id: "m2", round: 1, dependsOn: [], participantIds: ["a", "c"] },
    ];
    const result = scheduleGreedy(matches, slots(10, "v1", 30), [], { minRestMin: 60, maxMatchesPerDay: 10 });
    const m1 = result.placed.find((p) => p.matchId === "m1")!;
    const m2 = result.placed.find((p) => p.matchId === "m2")!;
    expect(Math.abs(m2.start.getTime() - m1.start.getTime())).toBeGreaterThanOrEqual(60 * 60_000 + 30 * 60_000);
  });
});
