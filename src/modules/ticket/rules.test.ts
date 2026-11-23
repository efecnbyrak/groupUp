import { describe, expect, it } from "vitest";

import { canClose, canReopen, statusAfterMessage } from "./rules";

describe("ticket kuralları", () => {
  it("mesaj sonrası durum tarafa göre", () => {
    expect(statusAfterMessage("OPEN", "responder")).toBe("ANSWERED");
    expect(statusAfterMessage("ANSWERED", "requester")).toBe("OPEN");
    expect(statusAfterMessage("OPEN", "requester")).toBe("OPEN");
    expect(statusAfterMessage("CLOSED", "requester")).toBeNull();
  });

  it("kapatma", () => {
    expect(canClose("OPEN")).toBe(true);
    expect(canClose("ANSWERED")).toBe(true);
    expect(canClose("CLOSED")).toBe(false);
  });

  it("7 gün içinde yeniden açma", () => {
    const closedAt = new Date("2026-11-01T10:00:00Z");
    expect(canReopen("CLOSED", closedAt, new Date("2026-11-08T10:00:00Z"))).toBe(true);
    expect(canReopen("CLOSED", closedAt, new Date("2026-11-08T10:00:01Z"))).toBe(false);
    expect(canReopen("OPEN", closedAt, new Date("2026-11-02T00:00:00Z"))).toBe(false);
    expect(canReopen("CLOSED", null, new Date())).toBe(false);
  });
});
