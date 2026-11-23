import { expect, test } from "@playwright/test";

test("landing açılır, TR varsayılan, EN'e geçilir", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/");
  await expect(page).toHaveTitle("groupUp");
  await expect(page.getByRole("heading", { level: 1, name: "Kulübün tüm etkinlikleri tek yerde." })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "tr");

  await page.getByRole("contentinfo").getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "All your club's events in one place." })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "All your club's events in one place." })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await context.clearCookies();
});

for (const width of [1440, 1024, 768, 390, 360]) {
  test(`yatay taşma yok — ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/giris", "/kayit"]) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
}
