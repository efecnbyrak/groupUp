import { describe, expect, it } from "vitest";

import { buildExportColumns, buildExportRow, canCompleteTeam, decideCapacity, isFieldVisible, teamSizeProblem, validateAnswers, type FieldDef } from "./rules";

const f = (over: Partial<FieldDef> = {}): FieldDef => ({
  id: "f1",
  type: "SHORT_TEXT",
  order: 0,
  labelTr: "Alan",
  required: false,
  teamLevel: false,
  hidden: false,
  options: null,
  config: null,
  showIfFieldId: null,
  showIfValue: null,
  ...over,
});

describe("isFieldVisible", () => {
  it("koşulsuz alan her zaman görünür", () => {
    expect(isFieldVisible(f(), {})).toBe(true);
  });
  it("referans değer eşleşince görünür", () => {
    const field = f({ showIfFieldId: "pos", showIfValue: "forma" });
    expect(isFieldVisible(field, { pos: "forma" })).toBe(true);
    expect(isFieldVisible(field, { pos: "diğer" })).toBe(false);
    expect(isFieldVisible(field, {})).toBe(false);
  });
});

describe("validateAnswers", () => {
  it("zorunlu alan boşsa hata, doluysa temiz değer", () => {
    const fields = [f({ id: "ad", required: true })];
    expect(validateAnswers(fields, {}).errors).toEqual({ ad: "validation.required" });
    expect(validateAnswers(fields, { ad: "" }).errors).toEqual({ ad: "validation.required" });
    expect(validateAnswers(fields, { ad: "Mert" }).clean).toEqual({ ad: "Mert" });
  });

  it("gizli alan doğrulanmaz", () => {
    const fields = [f({ id: "x", required: true, hidden: true })];
    expect(validateAnswers(fields, {})).toEqual({ errors: {}, clean: {} });
  });

  it("görünmeyen koşullu alan zorunlu olsa da atlanır", () => {
    const fields = [f({ id: "forma", required: true, showIfFieldId: "pos", showIfValue: "oyuncu" })];
    expect(validateAnswers(fields, { pos: "kaleci" }).errors).toEqual({});
  });

  it("SECTION cevap istemez", () => {
    expect(validateAnswers([f({ id: "s", type: "SECTION", required: true })], {})).toEqual({ errors: {}, clean: {} });
  });

  it("SHORT_TEXT: maxLength ve pattern", () => {
    const fields = [f({ id: "mail", config: { pattern: "email" } }), f({ id: "k", config: { maxLength: 3 } })];
    const r = validateAnswers(fields, { mail: "gecersiz", k: "abcd" });
    expect(r.errors).toEqual({ mail: "validation.email", k: "validation.tooLong" });
    expect(validateAnswers(fields, { mail: "a@b.com", k: "ab" }).clean).toEqual({ mail: "a@b.com", k: "ab" });
  });

  it("NUMBER: tamsayı ve aralık", () => {
    const fields = [f({ id: "n", type: "NUMBER", config: { min: 1, max: 5, integer: true } })];
    expect(validateAnswers(fields, { n: 2.5 }).errors).toEqual({ n: "validation.number" });
    expect(validateAnswers(fields, { n: 9 }).errors).toEqual({ n: "validation.number" });
    expect(validateAnswers(fields, { n: "3" }).clean).toEqual({ n: 3 });
  });

  it("DATE: geçersiz tarih hata verir, geçerli ISO güne indirgenir", () => {
    const fields = [f({ id: "d", type: "DATE" })];
    expect(validateAnswers(fields, { d: "yarın" }).errors).toEqual({ d: "validation.date" });
    expect(validateAnswers(fields, { d: "2026-05-10" }).clean).toEqual({ d: "2026-05-10" });
  });

  it("BOOLEAN serbest, CONSENT zorunluysa işaretlenmeli", () => {
    const fields = [f({ id: "b", type: "BOOLEAN" }), f({ id: "c", type: "CONSENT", required: true })];
    expect(validateAnswers(fields, { b: false, c: false }).errors).toEqual({ c: "validation.required" });
    expect(validateAnswers(fields, { b: false, c: true }).clean).toEqual({ b: false, c: true });
  });

  it("SINGLE_CHOICE/DROPDOWN yalnızca tanımlı seçenek kabul eder", () => {
    const opts = [{ value: "a", labelTr: "A", labelEn: "A" }];
    const fields = [f({ id: "s", type: "SINGLE_CHOICE", options: opts })];
    expect(validateAnswers(fields, { s: "z" }).errors).toEqual({ s: "validation.invalid" });
    expect(validateAnswers(fields, { s: "a" }).clean).toEqual({ s: "a" });
  });

  it("MULTI_CHOICE: min/max seçim ve yinelenenler temizlenir", () => {
    const opts = [
      { value: "a", labelTr: "A", labelEn: "A" },
      { value: "b", labelTr: "B", labelEn: "B" },
      { value: "c", labelTr: "C", labelEn: "C" },
    ];
    const fields = [f({ id: "m", type: "MULTI_CHOICE", options: opts, config: { minSelect: 1, maxSelect: 2 } })];
    expect(validateAnswers(fields, { m: [] }).errors).toEqual({});
    expect(validateAnswers(fields, { m: ["a", "b", "c"] }).errors).toEqual({ m: "validation.invalid" });
    expect(validateAnswers(fields, { m: ["a", "a"] }).clean).toEqual({ m: ["a"] });
  });

  it("FILE: yalnızca kendi klasöründeki anahtar kabul edilir", () => {
    const fields = [f({ id: "belge", type: "FILE" })];
    expect(validateAnswers(fields, { belge: "../../etc/passwd" }).errors).toEqual({ belge: "validation.invalid" });
    expect(validateAnswers(fields, { belge: "registrations/e1/u1/x.pdf" }).clean).toEqual({ belge: "registrations/e1/u1/x.pdf" });
  });

  it("scope: team yalnızca teamLevel alanları ister", () => {
    const fields = [f({ id: "takimAdi", teamLevel: true, required: true }), f({ id: "bireysel", required: true })];
    expect(validateAnswers(fields, {}, "team").errors).toEqual({ takimAdi: "validation.required" });
    expect(validateAnswers(fields, {}, "individual").errors).toEqual({ bireysel: "validation.required" });
  });
});

describe("decideCapacity", () => {
  it("sınırsız kontenjan: autoAccept'e göre ACCEPTED/APPLIED", () => {
    expect(decideCapacity({ capacity: null, waitlistEnabled: true, autoAccept: true, taken: 999 })).toEqual({ status: "ACCEPTED" });
    expect(decideCapacity({ capacity: null, waitlistEnabled: true, autoAccept: false, taken: 0 })).toEqual({ status: "APPLIED" });
  });
  it("yer varken autoAccept kapalıysa APPLIED", () => {
    expect(decideCapacity({ capacity: 10, waitlistEnabled: true, autoAccept: false, taken: 3 })).toEqual({ status: "APPLIED" });
  });
  it("doluysa yedek liste açıksa WAITLISTED, kapalıysa BLOCKED", () => {
    expect(decideCapacity({ capacity: 10, waitlistEnabled: true, autoAccept: true, taken: 10 })).toEqual({ status: "WAITLISTED" });
    expect(decideCapacity({ capacity: 10, waitlistEnabled: false, autoAccept: true, taken: 10 })).toEqual({ status: "BLOCKED" });
  });
});

describe("takım boyutu", () => {
  it("teamSizeProblem", () => {
    expect(teamSizeProblem(2, 3, 5)).toBe("TEAM_TOO_SMALL");
    expect(teamSizeProblem(5, 3, 5)).toBe("TEAM_FULL");
    expect(teamSizeProblem(4, 3, 5)).toBeNull();
  });
  it("canCompleteTeam", () => {
    expect(canCompleteTeam(2, 3)).toBe(false);
    expect(canCompleteTeam(3, 3)).toBe(true);
  });
});

describe("dışa aktarım", () => {
  const fields: FieldDef[] = [
    f({ id: "forma", type: "NUMBER", order: 1, labelTr: "Forma no" }),
    f({ id: "poz", type: "SINGLE_CHOICE", order: 0, labelTr: "Pozisyon", options: [{ value: "k", labelTr: "Kaleci", labelEn: "Goalkeeper" }] }),
    f({ id: "sec", type: "SECTION", order: -1, labelTr: "Başlık" }),
  ];
  it("sütunlar sıralı, SECTION hariç, snapshot + takım + durum + tarih dahil", () => {
    const cols = buildExportColumns(fields, [{ key: "adSoyad", header: "Ad Soyad" }], "tr");
    expect(cols.map((c) => c.key)).toEqual(["adSoyad", "team", "poz", "forma", "status", "createdAt"]);
  });
  it("satır: seçim etiketi, takım adı, durum ve snapshot alanları doldurulur", () => {
    const cols = buildExportColumns(fields, [{ key: "adSoyad", header: "Ad Soyad" }], "tr");
    const row = buildExportRow(
      fields,
      cols,
      { snapshot: { adSoyad: "Ayşe Yılmaz" }, answers: { forma: 9, poz: "k" }, teamName: "Takım X", status: "ACCEPTED", createdAt: new Date("2026-01-02") },
      "Kabul edildi",
    );
    expect(row).toEqual({ adSoyad: "Ayşe Yılmaz", team: "Takım X", poz: "Kaleci", forma: "9", status: "Kabul edildi", createdAt: "2026-01-02" });
  });
});
