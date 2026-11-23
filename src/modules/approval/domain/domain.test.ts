import { describe, expect, it } from "vitest";

import { changedOnly, diffFields } from "./diff";
import { checkRejectReason, REJECT_REASON_MAX } from "./reason";
import { createRegistry } from "./registry";
import { staffSlotsUsed, wouldExceedStaffLimit } from "./staff-limit";
import { canTransition, isFinal, nextStatus, REQUEST_STATUSES, TransitionError } from "./state-machine";

describe("state-machine", () => {
  it("PENDING'den üç karar", () => {
    expect(nextStatus("PENDING", "APPROVE")).toBe("APPROVED");
    expect(nextStatus("PENDING", "REJECT")).toBe("REJECTED");
    expect(nextStatus("PENDING", "CANCEL")).toBe("CANCELLED");
  });

  it("son durumlardan çıkış yok (idempotent karar)", () => {
    for (const from of REQUEST_STATUSES.filter((s) => s !== "PENDING")) {
      expect(isFinal(from)).toBe(true);
      for (const d of ["APPROVE", "REJECT", "CANCEL"] as const) {
        expect(canTransition(from, d)).toBe(false);
        expect(() => nextStatus(from, d)).toThrow(TransitionError);
      }
    }
    expect(isFinal("PENDING")).toBe(false);
  });
});

describe("registry", () => {
  it("tipe göre handler döner", () => {
    const r = createRegistry([{ type: "A", n: 1 }, { type: "B", n: 2 }]);
    expect(r.get("B").n).toBe(2);
    expect(r.has("A")).toBe(true);
    expect(r.has("C")).toBe(false);
    expect(r.types()).toEqual(["A", "B"]);
  });

  it("eksik tip ve çift kayıt hatası", () => {
    expect(() => createRegistry([{ type: "A" }]).get("Z")).toThrow(/Handler yok/);
    expect(() => createRegistry([{ type: "A" }, { type: "A" }])).toThrow(/iki kez/);
  });
});

describe("diff", () => {
  it("yalnızca değişen alanlar, boş = null", () => {
    const rows = diffFields({ a: "x", b: "y", c: "", d: ["1"] }, { a: "x", b: "z", c: null, d: ["1", "2"] });
    expect(rows).toEqual([
      { field: "b", before: "y", after: "z" },
      { field: "d", before: ["1"], after: ["1", "2"] },
    ]);
  });

  it("keys sırası ve after'da olmayan alan atlanır; nesneler JSON", () => {
    const rows = diffFields({ a: 1, b: { x: 1 } }, { b: { x: 2 }, a: 2 }, ["b", "a", "q"]);
    expect(rows.map((r) => r.field)).toEqual(["b", "a"]);
    expect(rows[0]!.after).toBe('{"x":2}');
    expect(diffFields({ a: true }, { a: true })).toEqual([]);
  });

  it("changedOnly", () => {
    expect(changedOnly({ a: 1, b: 2 }, { a: 1, b: 3 })).toEqual({ b: 3 });
  });
});

describe("reason", () => {
  it("kurallar", () => {
    expect(checkRejectReason("   ")).toBe("required");
    expect(checkRejectReason("kısa")).toBe("tooShort");
    expect(checkRejectReason("  on karakter  ")).toBeNull();
    expect(checkRejectReason("x".repeat(REJECT_REASON_MAX + 1))).toBe("tooLong");
    expect(checkRejectReason("x".repeat(REJECT_REASON_MAX))).toBeNull();
  });
});

describe("staff-limit", () => {
  it("bekleyen yeni kişiler yer tutar, mevcut görevlinin güncellemesi tutmaz", () => {
    expect(staffSlotsUsed(["a", "b"], ["b", "c"])).toBe(3);
  });

  it("sınır", () => {
    const staff = Array.from({ length: 8 }, (_, i) => `s${i}`);
    expect(wouldExceedStaffLimit("new", staff, [], 9)).toBe(false);
    expect(wouldExceedStaffLimit("new", staff, ["p"], 9)).toBe(true);
    expect(wouldExceedStaffLimit("s1", [...staff, "s8"], [], 9)).toBe(false); // güncelleme
    expect(wouldExceedStaffLimit("p", staff, ["p"], 9)).toBe(false); // zaten bekleyen talebi güncelliyor
  });
});
