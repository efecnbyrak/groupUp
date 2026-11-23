import { describe, expect, it } from "vitest";

import { formatDate, formatDateTime } from "./dates";

describe("tarih gösterimi", () => {
  // 2026-03-01 21:30 UTC = 2 Mart 00:30 İstanbul (UTC+3)
  const d = new Date("2026-03-01T21:30:00Z");
  it("İstanbul saat dilimine çevirir", () => {
    expect(formatDate(d, "tr")).toContain("2 Mar");
    expect(formatDateTime(d, "tr")).toContain("00:30");
  });
  it("İngilizce biçim", () => {
    expect(formatDate(d, "en")).toBe("2 Mar 2026");
  });
});

import { fromIstanbulLocalInput, toIstanbulLocalInput } from "./dates";

describe("datetime-local (İstanbul)", () => {
  it("gidiş-dönüş", () => {
    const d = new Date("2026-03-01T21:30:00Z");
    expect(toIstanbulLocalInput(d)).toBe("2026-03-02T00:30");
    expect(fromIstanbulLocalInput("2026-03-02T00:30")?.toISOString()).toBe(d.toISOString());
    expect(fromIstanbulLocalInput("bozuk")).toBeNull();
  });
});
