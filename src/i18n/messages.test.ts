import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import tr from "../../messages/tr.json";

import { createT, toLocale } from "./messages";

function leaves(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "string" ? [`${prefix}${k}`] : leaves(v as object, `${prefix}${k}.`),
  );
}

describe("i18n", () => {
  it("tr ve en aynı anahtarlara sahip", () => {
    expect(leaves(en).sort()).toEqual(leaves(tr).sort());
  });

  it("değişkenleri yerleştirir, bilinmeyen locale tr'ye düşer", () => {
    expect(createT("en")("auth.account.signedInAs", { email: "a@b.c" })).toBe("Signed in as a@b.c.");
    expect(toLocale("de")).toBe("tr");
    expect(createT("tr")("auth.login.title")).toBe("Giriş yap");
  });
});
