import { expect, test } from "@playwright/test";

import { demoAdmin, login } from "./helpers";

// 1×1 PNG (sunucuda 16:9 WebP'ye çevrilir)
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

const local = (offsetDays: number, hour: number) => {
  const d = new Date(Date.now() + offsetDays * 86_400_000 + 3 * 3600_000); // İstanbul (UTC+3)
  return `${d.toISOString().slice(0, 10)}T${String(hour).padStart(2, "0")}:00`;
};

/**
 * F6: Başkan etkinlik oluşturur (sihirbaz, otomatik kayıt, kapak) → onaya gönderir → Admin onaylar →
 * üyenin akışında ve Keşfet'te görünür. Önkoşul: `db:seed` + `db:seed:demo`.
 */
test("etkinlik oluştur → onaya gönder → Admin onayı → akışta görünür", async ({ browser }) => {
  test.setTimeout(180_000);
  const { password } = demoAdmin();
  const title = `E2E Etkinlik ${Date.now().toString().slice(-7)}`;
  const page = async () => (await browser.newContext()).newPage();

  // 1) Başkan: yeni taslak
  const p = await page();
  await login(p, "demo.baskan@ogr.kent.edu.tr", password);
  await p.goto("/panel/kulup/kent-spor/etkinlikler");
  await p.getByRole("button", { name: "Yeni etkinlik" }).click();
  const dialog = p.getByRole("dialog");
  await dialog.getByLabel("Kategori").selectOption({ label: "Satranç" });
  await dialog.getByLabel("Başlık").fill(title);
  await dialog.getByRole("button", { name: "Taslak oluştur" }).click();
  await expect(p).toHaveURL(/\/panel\/kulup\/kent-spor\/etkinlikler\/[a-z0-9]+$/);

  // 2) Sihirbaz
  const main = p.locator("main");
  await main.getByLabel("Kısa özet").filter({ visible: true }).fill("Uçtan uca test etkinliği.");
  await main.locator('input[type="file"]').first().setInputFiles({ name: "kapak.png", mimeType: "image/png", buffer: PNG });
  await expect(main.locator("img").first()).toBeVisible();
  await main.getByRole("button", { name: /Açıklama$/ }).click();
  await main.getByRole("textbox", { name: "Açıklama" }).click();
  await p.keyboard.type("Satranç turnuvası, İsviçre sistemi.");
  await main.getByRole("button", { name: /Zaman ve yer$/ }).click();
  await main.getByLabel("Başlangıç", { exact: true }).fill(local(10, 10));
  await main.getByLabel("Bitiş", { exact: true }).fill(local(10, 16));
  await main.getByLabel("Başvuru açılışı").fill(local(-1, 9));
  await main.getByLabel("Son başvuru (deadline)").fill(local(7, 23));
  await main.getByLabel("Yer adı").fill("Kütüphane salonu");
  await main.getByRole("button", { name: /Önizleme ve gönder$/ }).click();
  await expect(main.getByText("Etkinlik onaya gönderilmeye hazır.")).toBeVisible();
  await main.getByRole("button", { name: "Onaya gönder" }).click();
  await expect(main.getByText("Etkinlik Admin onayı bekliyor.")).toBeVisible({ timeout: 20_000 });
  const eventId = p.url().split("/").pop()!;

  // 3) Admin onayı
  const a = await page();
  await login(a, "demo.admin@ogr.kent.edu.tr", password);
  await a.goto("/panel/admin/onay-kuyrugu");
  const links = a.getByRole("link", { name: /Etkinlik yayını/ }).filter({ visible: true });
  await expect(links.first()).toBeVisible();
  const hrefs = await links.evaluateAll((els) => els.map((e) => e.getAttribute("href")!));
  let found = false;
  for (const h of hrefs) {
    await a.goto(h);
    if ((await a.getByRole("link", { name: "Etkinliği aç" }).getAttribute("href")) === `/etkinlikler/${eventId}`) {
      found = true;
      break;
    }
  }
  expect(found).toBe(true);
  await a.getByRole("button", { name: "Onayla" }).click();
  await a.getByRole("dialog").getByRole("button", { name: "Onayla" }).click();
  await expect(a.getByText(/onaylandı/i).first()).toBeVisible();

  // 4) Üye akışında ve Keşfet'te
  const m = await page();
  await login(m, "demo.uye@ogr.kent.edu.tr", password);
  await m.goto("/akis");
  await expect(m.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  await m.goto(`/kesfet?q=${encodeURIComponent(title)}`);
  await m.getByRole("link", { name: new RegExp(title) }).click();
  await expect(m.getByRole("heading", { name: title })).toBeVisible();
});
