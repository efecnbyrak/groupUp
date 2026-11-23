import { describe, expect, it } from "vitest";

import { initials } from "./avatar";
import { cn } from "./cn";
import { normalizeOtp } from "./otp";
import { sortRows } from "./table-sort";

describe("ui yardımcıları", () => {
  it("cn koşullu sınıfları birleştirir", () => {
    expect(cn("a", false && "b", undefined, "c")).toBe("a c");
  });

  it("normalizeOtp rakam dışını atar ve kırpar", () => {
    expect(normalizeOtp(" 123 456 ")).toBe("123456");
    expect(normalizeOtp("12a3-4567890")).toBe("123456");
    expect(normalizeOtp("12", 6)).toBe("12");
  });

  it("initials Türkçe büyük harf kullanır", () => {
    expect(initials("ilknur şahin")).toBe("İŞ");
    expect(initials("Efe")).toBe("E");
    expect(initials("  Ali  Veli Can ")).toBe("AC");
  });

  it("sortRows: Türkçe sıralama, sayılar, boşlar sonda, kararlı", () => {
    const rows = [
      { id: "1", sort: { name: "Şule", n: 3 } },
      { id: "2", sort: { name: "Can", n: null } },
      { id: "3", sort: { name: "Çağla", n: 10 } },
      { id: "4", sort: { name: "", n: 2 } },
    ];
    expect(sortRows(rows, "name", "asc").map((r) => r.id)).toEqual(["2", "3", "1", "4"]);
    expect(sortRows(rows, "name", "desc").map((r) => r.id)).toEqual(["1", "3", "2", "4"]);
    expect(sortRows(rows, "n", "asc").map((r) => r.id)).toEqual(["4", "1", "3", "2"]);
    expect(sortRows(rows, null, "asc").map((r) => r.id)).toEqual(["1", "2", "3", "4"]);
  });
});
