import { expect, test } from "@playwright/test";

test("ana sayfa açılır", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("groupUp");
  await expect(page.getByRole("heading", { level: 1, name: "groupUp" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "tr");
});
