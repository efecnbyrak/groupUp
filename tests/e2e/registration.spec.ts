import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";

import { demoAdmin, login } from "./helpers";

const local = (offsetDays: number, hour: number) => {
  const d = new Date(Date.now() + offsetDays * 86_400_000 + 3 * 3600_000); // İstanbul (UTC+3)
  return `${d.toISOString().slice(0, 10)}T${String(hour).padStart(2, "0")}:00`;
};

/** Başkan + Admin ile hızlı yayınlanmış etkinlik oluşturur, verilen `configure` ile Katılım adımını ayarlar. */
async function publishQuickEvent(browser: Browser, password: string, title: string, configure: (main: Locator) => Promise<void>): Promise<string> {
  const page = await (await browser.newContext()).newPage();
  await login(page, "demo.baskan@ogr.kent.edu.tr", password);
  await page.goto("/panel/kulup/kent-spor/etkinlikler");
  await page.getByRole("button", { name: "Yeni etkinlik" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Kategori").selectOption({ label: "Satranç" });
  await dialog.getByLabel("Başlık").fill(title);
  await dialog.getByRole("button", { name: "Taslak oluştur" }).click();
  await expect(page).toHaveURL(/\/panel\/kulup\/kent-spor\/etkinlikler\/[a-z0-9]+$/);
  const eventId = page.url().split("/").pop()!;

  const main = page.locator("main");
  await main.getByLabel("Kısa özet").filter({ visible: true }).fill("E2E test etkinliği.");
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
  await main.locator('input[type="file"]').first().setInputFiles({ name: "kapak.png", mimeType: "image/png", buffer: PNG });
  await expect(main.locator("img").first()).toBeVisible();

  await main.getByRole("button", { name: /Açıklama$/ }).click();
  await main.getByRole("textbox", { name: "Açıklama" }).click();
  await page.keyboard.type("Test açıklaması.");

  await main.getByRole("button", { name: /Zaman ve yer$/ }).click();
  await main.getByLabel("Başlangıç", { exact: true }).fill(local(10, 10));
  await main.getByLabel("Bitiş", { exact: true }).fill(local(10, 16));
  await main.getByLabel("Başvuru açılışı").fill(local(-1, 9));
  await main.getByLabel("Son başvuru (deadline)").fill(local(7, 23));
  await main.getByLabel("Yer adı").fill("Test salonu");

  await main.getByRole("button", { name: /Katılım$/ }).click();
  await configure(main);

  await main.getByRole("button", { name: /Önizleme ve gönder$/ }).click();
  await main.getByRole("button", { name: "Onaya gönder" }).click();
  await expect(main.getByText("Etkinlik Admin onayı bekliyor.")).toBeVisible({ timeout: 20_000 });

  const admin = await (await browser.newContext()).newPage();
  await login(admin, "demo.admin@ogr.kent.edu.tr", password);
  await admin.goto("/panel/admin/onay-kuyrugu");
  const links = admin.getByRole("link", { name: /Etkinlik yayını/ }).filter({ visible: true });
  await expect(links.first()).toBeVisible();
  const hrefs = await links.evaluateAll((els: HTMLAnchorElement[]) => els.map((e) => e.getAttribute("href")!));
  let found = false;
  for (const h of hrefs) {
    await admin.goto(h);
    if ((await admin.getByRole("link", { name: "Etkinliği aç" }).getAttribute("href")) === `/etkinlikler/${eventId}`) {
      found = true;
      break;
    }
  }
  expect(found).toBe(true);
  await admin.getByRole("button", { name: "Onayla" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Onayla" }).click();
  await expect(admin.getByText(/onaylandı/i).first()).toBeVisible();

  return eventId;
}

test.describe("başvuru akışı", () => {
  test("bireysel başvuru: kontenjan dolunca yedek, iptalde otomatik terfi, xlsx indir", async ({ browser }) => {
    test.setTimeout(240_000);
    const { password } = demoAdmin();
    const title = `E2E Bireysel ${Date.now().toString().slice(-7)}`;
    const eventId = await publishQuickEvent(browser, password, title, async (main) => {
      await main.getByLabel("Kontenjan", { exact: true }).fill("1");
    });

    const page = async () => (await browser.newContext()).newPage();

    // Birinci başvuran: kabul edilir
    const first = await page();
    await login(first, "demo.ogrenci04@ogr.kent.edu.tr", password);
    await first.goto(`/etkinlikler/${eventId}`);
    await first.getByRole("button", { name: "Başvur" }).click();
    await expect(first.getByText("Kabul edildi", { exact: true })).toBeVisible({ timeout: 10_000 });

    // İkinci başvuran: kontenjan dolu, yedek listeye düşer
    const second = await page();
    await login(second, "demo.ogrenci05@ogr.kent.edu.tr", password);
    await second.goto(`/etkinlikler/${eventId}`);
    await second.getByRole("button", { name: "Başvur" }).click();
    await expect(second.getByText("Yedek listede", { exact: true })).toBeVisible({ timeout: 10_000 });

    // Birinci iptal eder → ikinci otomatik terfi eder
    first.on("dialog", (d) => void d.accept());
    await first.getByRole("button", { name: "Başvuruyu iptal et" }).click();
    await expect(first.getByText("İptal edildi", { exact: true })).toBeVisible({ timeout: 10_000 });
    await second.reload();
    await expect(second.getByText("Kabul edildi", { exact: true })).toBeVisible({ timeout: 10_000 });

    // Başkan: yönetim tablosunda görür, xlsx indirir
    const admin = await page();
    await login(admin, "demo.baskan@ogr.kent.edu.tr", password);
    const res = await admin.request.get(`/api/v1/registrations/export?clubId=${await clubIdOf(admin)}&eventId=${eventId}&format=xlsx`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("spreadsheetml");
  });

  test("takım: kur, kodla katıl, başvuruyu tamamla", async ({ browser }) => {
    test.setTimeout(240_000);
    const { password } = demoAdmin();
    const title = `E2E Takım ${Date.now().toString().slice(-7)}`;
    const eventId = await publishQuickEvent(browser, password, title, async (main) => {
      await main.getByLabel("Katılım türü").selectOption({ label: "Takım" });
      await main.getByLabel("En az üye").fill("2");
      await main.getByLabel("En çok üye").fill("3");
    });

    const page = async () => (await browser.newContext()).newPage();

    const captain = await page();
    await login(captain, "demo.gorevli@ogr.kent.edu.tr", password);
    await captain.goto(`/etkinlikler/${eventId}`);
    await captain.getByRole("button", { name: "Takım kur" }).click();
    await captain.getByLabel("Takım adı").fill("E2E Takımı");
    await captain.getByRole("button", { name: "Takımı oluştur" }).click();
    await expect(captain.locator("#icerik").getByText("E2E Takımı")).toBeVisible({ timeout: 10_000 });
    const code = (await captain.locator("code").first().textContent())!.trim();
    expect(code).toHaveLength(6);

    const member = await page();
    await login(member, "demo.uye@ogr.kent.edu.tr", password);
    await member.goto(`/etkinlikler/${eventId}`);
    await member.getByRole("button", { name: "Kodla katıl" }).click();
    await member.getByLabel("Takım kodu").fill(code);
    await member.getByRole("button", { name: "Katıl" }).click();
    await expect(member.getByText("E2E Takımı")).toBeVisible({ timeout: 10_000 });

    await captain.reload();
    captain.on("dialog", (d) => void d.accept());
    await captain.getByRole("button", { name: "Başvuruyu tamamla" }).click();
    await expect(captain.getByText("Kabul edildi", { exact: true })).toBeVisible({ timeout: 10_000 });
  });
});

async function clubIdOf(page: Page): Promise<string> {
  await page.goto("/panel/kulup/kent-spor/duyurular");
  const value = await page.locator('input[name="clubId"]').first().getAttribute("value");
  if (!value) throw new Error("clubId bulunamadı");
  return value;
}
