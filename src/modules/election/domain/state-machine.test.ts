import { describe, expect, it } from "vitest";

import { deriveTimeStatus, isCandidacyWindowOpen, isVotingWindowOpen, tally, validateWindow } from "./state-machine";

const w = {
  candidacyOpensAt: new Date("2026-01-01T00:00:00Z"),
  candidacyClosesAt: new Date("2026-01-05T00:00:00Z"),
  votingOpensAt: new Date("2026-01-06T00:00:00Z"),
  votingClosesAt: new Date("2026-01-08T00:00:00Z"),
};

describe("validateWindow", () => {
  it("doğru sıralı tarihleri kabul eder", () => expect(validateWindow(w)).toBe(true));
  it("candidacyClosesAt > votingOpensAt ise reddeder", () => {
    expect(validateWindow({ ...w, candidacyClosesAt: new Date("2026-01-07T00:00:00Z") })).toBe(false);
  });
  it("eşit candidacyClosesAt/votingOpensAt kabul eder (ara süresiz)", () => {
    expect(validateWindow({ ...w, votingOpensAt: w.candidacyClosesAt })).toBe(true);
  });
  it("votingOpensAt >= votingClosesAt ise reddeder", () => {
    expect(validateWindow({ ...w, votingClosesAt: w.votingOpensAt })).toBe(false);
  });
});

describe("deriveTimeStatus", () => {
  it("candidacyOpensAt'tan önce DRAFT", () => expect(deriveTimeStatus("DRAFT", w, new Date("2025-12-31T00:00:00Z"))).toBe("DRAFT"));
  it("adaylık penceresinde CANDIDACY", () => expect(deriveTimeStatus("DRAFT", w, new Date("2026-01-02T00:00:00Z"))).toBe("CANDIDACY"));
  it("candidacyClosesAt sonrası, votingOpensAt öncesi hâlâ CANDIDACY", () => expect(deriveTimeStatus("CANDIDACY", w, new Date("2026-01-05T12:00:00Z"))).toBe("CANDIDACY"));
  it("oy penceresinde VOTING", () => expect(deriveTimeStatus("CANDIDACY", w, new Date("2026-01-07T00:00:00Z"))).toBe("VOTING"));
  it("votingClosesAt sonrası CLOSED", () => expect(deriveTimeStatus("VOTING", w, new Date("2026-01-09T00:00:00Z"))).toBe("CLOSED"));
  it("CLOSED/RESULT_PENDING/FINALIZED/CANCELLED artık zamanla sürülmez", () => {
    expect(deriveTimeStatus("CLOSED", w, new Date("2026-01-09T00:00:00Z"))).toBeNull();
    expect(deriveTimeStatus("RESULT_PENDING", w, new Date("2026-01-09T00:00:00Z"))).toBeNull();
    expect(deriveTimeStatus("FINALIZED", w, new Date("2026-01-09T00:00:00Z"))).toBeNull();
    expect(deriveTimeStatus("CANCELLED", w, new Date("2026-01-09T00:00:00Z"))).toBeNull();
  });
});

describe("window açık mı", () => {
  it("isCandidacyWindowOpen", () => {
    expect(isCandidacyWindowOpen(w, new Date("2026-01-02T00:00:00Z"))).toBe(true);
    expect(isCandidacyWindowOpen(w, new Date("2026-01-05T00:00:00Z"))).toBe(false);
  });
  it("isVotingWindowOpen", () => {
    expect(isVotingWindowOpen(w, new Date("2026-01-07T00:00:00Z"))).toBe(true);
    expect(isVotingWindowOpen(w, new Date("2026-01-08T00:00:00Z"))).toBe(false);
  });
});

describe("tally", () => {
  it("çoklu adaylıkta en çok oyu alan kazanır", () => {
    const r = tally(["a", "b", "c"], ["a", "a", "b", "a", "c"]);
    expect(r.winnerId).toBe("a");
    expect(r.tie).toBe(false);
    expect(r.counts).toEqual({ a: 3, b: 1, c: 1 });
  });
  it("çoklu adaylıkta eşitlik → kazanan yok", () => {
    const r = tally(["a", "b"], ["a", "b"]);
    expect(r.winnerId).toBeNull();
    expect(r.tie).toBe(true);
  });
  it("tek adaylıkta Evet oyları fazlaysa aday kazanır", () => {
    const r = tally(["a"], ["a", "a", "NO"]);
    expect(r.winnerId).toBe("a");
    expect(r.tie).toBe(false);
    expect(r.counts).toEqual({ a: 2, NO: 1 });
  });
  it("tek adaylıkta Hayır oyları fazlaysa aday kaybeder", () => {
    const r = tally(["a"], ["a", "NO", "NO"]);
    expect(r.winnerId).toBeNull();
    expect(r.tie).toBe(false);
  });
  it("tek adaylıkta eşitlik → tie", () => {
    const r = tally(["a"], ["a", "NO"]);
    expect(r.winnerId).toBeNull();
    expect(r.tie).toBe(true);
  });
  it("aday yoksa kazanan yok, eşitlik değil", () => {
    const r = tally([], []);
    expect(r.winnerId).toBeNull();
    expect(r.tie).toBe(false);
  });
});
