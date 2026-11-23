import { describe, expect, it } from "vitest";

import { SLUG_PATTERN, slugify } from "./slug";

describe("slugify", () => {
  it("Türkçe harfleri ASCII'ye çevirir", () => {
    expect(slugify("İstanbul Kent Üniversitesi")).toBe("istanbul-kent-universitesi");
    expect(slugify("Çağdaş Şiir Öğrenci Topluluğu")).toBe("cagdas-siir-ogrenci-toplulugu");
  });
  it("noktalama ve fazla boşlukları teke indirir, uçları kırpar", () => {
    expect(slugify("  Bilim & Teknoloji -- Kulübü!  ")).toBe("bilim-teknoloji-kulubu");
  });
  it("aksanlı Latin harflerini sadeleştirir", () => {
    expect(slugify("Café Société")).toBe("cafe-societe");
  });
  it("uzunluğu sınırlar ve sonda tire bırakmaz", () => {
    const slug = slugify("a".repeat(10) + " " + "b".repeat(10), 11);
    expect(slug).toBe("aaaaaaaaaa");
    expect(SLUG_PATTERN.test(slug)).toBe(true);
  });
  it("yalnızca sembolden oluşan girdide boş döner", () => {
    expect(slugify("!!!")).toBe("");
  });
});
