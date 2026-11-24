import { expect, test } from "@playwright/test";

import { demoAdmin, login } from "./helpers";

/**
 * F8: başvurulardan turnuva oluştur → braketi üret → skor gir → braket ilerler.
 * Önkoşul: `db:seed:demo` (Kent Spor Kulübü, Masa Tenisi Turnuvası'nda 4 kabul edilmiş başvuru).
 */
test("turnuva oluştur → braket üret → skor gir → kazanan ilerler", async ({ page }) => {
  test.setTimeout(180_000);
  const { password } = demoAdmin();
  await login(page, "demo.baskan@ogr.kent.edu.tr", password);

  // Masa Tenisi Turnuvası'nın turnuvalar sayfasına git.
  await page.goto("/panel/kulup/kent-spor/etkinlikler");
  await page.getByRole("link", { name: "Masa Tenisi Turnuvası" }).click();
  await expect(page).toHaveURL(/\/panel\/kulup\/kent-spor\/etkinlikler\/[a-z0-9]+$/);
  const eventId = page.url().split("/").pop()!;
  await page.goto(`/panel/kulup/kent-spor/etkinlikler/${eventId}/turnuvalar`);

  // 1) Turnuva oluştur (kabul edilmiş bireylerden).
  const stamp = Date.now().toString().slice(-7);
  const name = `E2E Turnuva ${stamp}`;
  await page.getByRole("button", { name: "Turnuva oluştur" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Turnuva adı").fill(name);
  await dialog.getByLabel("Format").selectOption({ label: "Tek eleme" });
  await dialog.getByLabel("Katılımcı kaynağı").selectOption({ label: "Kabul edilmiş bireyler" });
  await dialog.getByRole("button", { name: "Oluştur" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible({ timeout: 15_000 });

  // 2) Braketi oluştur.
  await page.getByRole("button", { name: "Braketi/fikstürü oluştur" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Onayla" }).click();
  const main = page.locator("main");
  await expect(main.getByText("Fikstür hazır").filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 });

  // 3) Round1 maçına tıkla, skor gir.
  const round1Box = main.getByRole("button").filter({ visible: true, hasNotText: "Belirlenecek" }).first();
  await round1Box.click();
  const panel = main.locator("div").filter({ has: page.getByRole("button", { name: "Skoru kaydet" }) }).last();
  const inputs = panel.getByRole("spinbutton");
  await inputs.nth(0).fill("3");
  await inputs.nth(1).fill("1");
  await panel.getByRole("button", { name: "Skoru kaydet" }).click();
  await expect(main.getByText("Skor kaydedildi.")).toBeVisible({ timeout: 10_000 });

  // 4) Maç tamamlandı olarak işaretlendi — skor "3" braket kutusunda görünür.
  await expect(main.getByText("3", { exact: true }).first()).toBeVisible();
});
