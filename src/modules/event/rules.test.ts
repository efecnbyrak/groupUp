import { describe, expect, it } from "vitest";

import { countdown, isRegistrationOpen, pick, registrationState, submitProblems, variantKey, type SubmittableEvent } from "./rules";

const now = new Date("2026-11-23T12:00:00Z");
const h = (hours: number) => new Date(now.getTime() + hours * 3600_000);
const win = (over: Partial<Parameters<typeof registrationState>[0]> = {}) => ({
  status: "PUBLISHED",
  applyOpensAt: h(-24),
  applyClosesAt: h(24 * 5),
  capacity: 10,
  waitlistEnabled: true,
  ...over,
});

describe("registrationState", () => {
  it("yayında olmayan etkinlik kapalı", () => {
    expect(registrationState(win({ status: "DRAFT" }), now)).toBe("CLOSED");
  });
  it("açılış öncesi / açık / son 48 saat / kapanış", () => {
    expect(registrationState(win({ applyOpensAt: h(1) }), now)).toBe("NOT_OPEN");
    expect(registrationState(win(), now)).toBe("OPEN");
    expect(registrationState(win({ applyClosesAt: h(48) }), now)).toBe("CLOSING_SOON");
    expect(registrationState(win({ applyClosesAt: h(49) }), now)).toBe("OPEN");
    expect(registrationState(win({ applyClosesAt: now }), now)).toBe("CLOSED");
  });
  it("kontenjan dolunca yedek liste açıksa WAITLIST, değilse FULL", () => {
    expect(registrationState(win(), now, 10)).toBe("WAITLIST");
    expect(registrationState(win({ waitlistEnabled: false }), now, 10)).toBe("FULL");
    expect(registrationState(win({ capacity: null }), now, 999)).toBe("OPEN");
  });
  it("başvuru alınabilir durumlar", () => {
    const states = ["OPEN", "CLOSING_SOON", "WAITLIST", "FULL", "CLOSED", "NOT_OPEN"] as const;
    expect(states.map((s) => isRegistrationOpen(s))).toEqual([true, true, true, false, false, false]);
  });
});

describe("countdown / pick / variantKey", () => {
  it("gün-saat-dakika", () => {
    expect(countdown(new Date(now.getTime() + (2 * 24 + 4) * 3600_000 + 5 * 60_000), now)).toEqual({ days: 2, hours: 4, minutes: 5 });
    expect(countdown(now, now)).toBeNull();
  });
  it("pick: en yoksa tr", () => {
    expect(pick("en", "tr", "en")).toBe("en");
    expect(pick("en", "tr", null)).toBe("tr");
    expect(pick("en", "tr", "")).toBe("tr");
    expect(pick("tr", "tr", "en")).toBe("tr");
  });
  it("variantKey", () => {
    expect(variantKey("event/x/abc.webp", 400)).toBe("event/x/abc-400.webp");
  });
});

describe("submitProblems", () => {
  const ok: SubmittableEvent = {
    categoryIsLeaf: true,
    titleTr: "Turnuva",
    summaryTr: "Özet",
    descriptionTr: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Açıklama" }] }] },
    coverKey: "event/x/c.webp",
    isOnline: false,
    locationName: "Spor salonu",
    onlineUrl: null,
    startAt: h(24 * 10),
    endAt: h(24 * 10 + 4),
    applyOpensAt: h(-1),
    applyClosesAt: h(24 * 7),
    capacity: 32,
    mode: "INDIVIDUAL",
    teamMinSize: null,
    teamMaxSize: null,
  };
  it("eksiksiz etkinlik gönderilebilir", () => {
    expect(submitProblems(ok, now)).toEqual({});
  });
  it("eksik alanları ve tarih çelişkilerini bildirir", () => {
    const p = submitProblems(
      { ...ok, titleTr: " ", descriptionTr: { type: "doc", content: [{ type: "paragraph" }] }, coverKey: null, locationName: null, endAt: ok.startAt, applyClosesAt: ok.applyOpensAt, categoryIsLeaf: false },
      now,
    );
    expect(p).toMatchObject({
      titleTr: "validation.required",
      descriptionTr: "validation.required",
      coverKey: "event.errors.coverRequired",
      locationName: "validation.required",
      endAt: "event.errors.endBeforeStart",
      applyClosesAt: "event.errors.closeBeforeOpen",
      categoryId: "event.errors.categoryLeaf",
    });
  });
  it("online etkinlikte link zorunlu, deadline bitişten sonra olamaz, geçmiş tarih olmaz", () => {
    expect(submitProblems({ ...ok, isOnline: true, onlineUrl: null }, now)).toEqual({ onlineUrl: "validation.required" });
    expect(submitProblems({ ...ok, applyClosesAt: h(24 * 11) }, now)).toEqual({ applyClosesAt: "event.errors.closeAfterEnd" });
    expect(submitProblems({ ...ok, startAt: h(-5), endAt: h(-1), applyOpensAt: h(-10), applyClosesAt: h(-6) }, now)).toEqual({ endAt: "event.errors.inPast" });
  });
  it("takım boyutu aralığı", () => {
    expect(submitProblems({ ...ok, mode: "TEAM", teamMinSize: 5, teamMaxSize: 3 }, now)).toEqual({ teamMaxSize: "event.errors.teamRange" });
    expect(submitProblems({ ...ok, mode: "TEAM", teamMinSize: null, teamMaxSize: 3 }, now)).toEqual({ teamMinSize: "validation.number" });
  });
});
