import { expect, test } from "@playwright/test";

import { demoAdmin, login, registerStudent, uniqueStudentNo, waitForMail } from "./helpers";

/**
 * F5 kulüp akışı: Admin kulüp açar + Başkan atar → Başkan davet kodu üretir → öğrenciler kodla katılır →
 * Başkan görevli atama talebi gönderir → Admin onaylar → görevli ekipte, Başkana mail.
 * Önkoşul: dev DB'de `db:seed` + `db:seed:demo`, Mailpit açık.
 */
test("kulüp aç, davetle katıl, görevli talebi → Admin onayı", async ({ browser, request }) => {
  test.setTimeout(180_000);
  const stamp = Date.now().toString().slice(-7);
  const clubName = `E2E Kulübü ${stamp}`;
  const password = "Kahve!42x";
  const ctx = async () => (await browser.newContext()).newPage();

  const president = await ctx();
  const presidentEmail = await registerStudent(president, request, { studentNo: uniqueStudentNo(), password, firstName: "Başkanaday" });
  const joiner = await ctx();
  const joinerEmail = await registerStudent(joiner, request, { studentNo: uniqueStudentNo(), password, firstName: "Katılan" });

  // 1) Admin: kulüp aç + Başkan ata
  const admin = await ctx();
  const a = demoAdmin();
  await login(admin, a.email, a.password);
  await admin.goto("/panel/admin/kulupler");
  await admin.getByRole("button", { name: "Kulüp aç" }).click();
  const create = admin.getByRole("dialog");
  await create.getByLabel("Kulüp adı").fill(clubName);
  await create.getByLabel("Kategori").selectOption({ label: "Spor" });
  await create.getByLabel("Kısa açıklama").fill("Uçtan uca test kulübü.");
  await create.getByLabel("Başkanın e-postası").fill(presidentEmail);
  await create.getByRole("button", { name: "Kulübü aç" }).click();
  await expect(admin.getByRole("status").getByText("Kulüp açıldı.")).toBeVisible();
  await expect(admin.getByRole("link", { name: new RegExp(clubName) })).toBeVisible();

  // 2) Başkan: /kulupler → kulüp paneli → davet kodu oluştur
  await president.goto("/kulupler");
  await president.getByRole("link", { name: `Kulüp Paneli · ${clubName}` }).click();
  await expect(president).toHaveURL(/\/panel\/kulup\/e2e-kulubu-\d+$/);
  const panelUrl = president.url();
  await president.getByRole("link", { name: "Davet kodları" }).filter({ visible: true }).first().click();
  await president.getByRole("button", { name: "Kod oluştur" }).click();
  await expect(president.getByText("Davet kodu oluşturuldu.")).toBeVisible();
  const code = ((await president.locator("span.font-mono").filter({ visible: true }).first().textContent()) ?? "").trim();
  expect(code).toMatch(/^[A-Z2-9]{8}$/);

  // 3) Öğrenci: davet linki önizler, düğmeyle katılır
  await joiner.goto(`/katil/${code}`);
  await expect(joiner.getByRole("heading", { name: clubName })).toBeVisible();
  await joiner.getByRole("button", { name: "Kulübe katıl" }).click();
  await expect(joiner).toHaveURL(/\/kulupler\/e2e-kulubu-\d+\?katildi=1$/);
  await expect(joiner.getByText(`${clubName} kulübüne hoş geldin!`)).toBeVisible();
  await expect(joiner.getByText("Bu kulübün üyesisin")).toBeVisible();

  // 4) Başkan: görevli atama talebi (doğrudan uygulanmaz)
  await president.goto(`${panelUrl}/ekip`);
  await president.getByRole("button", { name: "Görevli ekle" }).click();
  const assign = president.getByRole("dialog");
  await assign.getByLabel("Üye", { exact: true }).selectOption({ label: `Katılan Kullanıcı · ${joinerEmail}` });
  await assign.getByLabel("Unvan").fill("Sayman");
  await assign.getByLabel("Davet kodları").check();
  await assign.getByRole("button", { name: "Onaya gönder" }).click();
  await expect(president.getByText(/1 görevli atama talebi onay bekliyor/)).toBeVisible();
  await expect(president.getByRole("cell", { name: "Sayman" })).toHaveCount(0);

  // 5) Admin: kuyrukta kulübün talebi → onayla
  await admin.goto("/panel/admin/onay-kuyrugu");
  await admin.getByRole("row", { name: new RegExp(clubName) }).getByRole("link", { name: /Görevli atama/ }).click();
  await expect(admin.getByRole("heading", { name: "Görevli atama" })).toBeVisible();
  await expect(admin.getByText("Sayman").first()).toBeVisible();
  await admin.getByRole("button", { name: "Onayla" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Onayla" }).click();
  await expect(admin.getByText(/tarihinde onaylandı/)).toBeVisible();

  // 6) Başkan: ekipte görünür, onay maili gelir
  await president.goto(`${panelUrl}/ekip`);
  await expect(president.getByRole("cell", { name: "Sayman" })).toBeVisible();
  const mail = await waitForMail(request, presidentEmail, /Talebin onaylandı/);
  expect(mail.text).toContain(clubName);
});
