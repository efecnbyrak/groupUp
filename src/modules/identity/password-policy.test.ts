import { describe, expect, it } from "vitest";

import { checkPassword } from "./password-policy";

describe("checkPassword", () => {
  it.each(["abc!12", "Şifre.1", "ğüşiöç#", "a".repeat(63) + "!"])("geçerli: %s", (pw) => {
    expect(checkPassword(pw)).toEqual([]);
  });

  it("uzunluk sınırları", () => {
    expect(checkPassword("ab!1")).toContain("length");
    expect(checkPassword("a".repeat(64) + "!")).toContain("length");
  });

  it("harf ve sembol zorunlu", () => {
    expect(checkPassword("123456!")).toEqual(["letter"]);
    expect(checkPassword("abcdef1")).toEqual(["symbol"]);
  });

  it.each([
    ["boşluk", "abc !12"],
    ["sekme", "abc\t!12"],
    ["<", "abc<!12"],
    [">", "abc>!12"],
    ["çift tırnak", 'abc"!12'],
    ["tek tırnak", "abc'!12"],
    ["backtick", "abc`!12"],
    ["slash", "abc/!12"],
    ["backslash", "abc\\!12"],
    ["noktalı virgül", "abc;!12"],
    ["emoji", "abc😀!12"],
    ["kontrol", "abc\u0007!12"],
  ])("yasak karakter: %s", (_name, pw) => {
    expect(checkPassword(pw)).toContain("allowedChars");
  });

  it("mailin yerel kısmını (öğrenci no) içeremez", () => {
    expect(checkPassword("x20231234!", { email: "20231234@ogr.kent.edu.tr" })).toEqual(["noPersonalInfo"]);
  });

  it("ad/soyad içeremez (Türkçe büyük/küçük harf duyarsız)", () => {
    expect(checkPassword("İREM!2024", { firstName: "İrem", lastName: "Yılmaz" })).toEqual(["noPersonalInfo"]);
    expect(checkPassword("yilmaz!1", { firstName: "İrem", lastName: "Yılmaz" })).toEqual([]);
    expect(checkPassword("yılmaz!1", { firstName: "İrem", lastName: "Yılmaz" })).toEqual(["noPersonalInfo"]);
  });

  it("çok kısa kişisel parçalar yok sayılır", () => {
    expect(checkPassword("alper!1", { firstName: "Al" })).toEqual([]);
  });
});
