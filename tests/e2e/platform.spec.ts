import { expect, test } from "@playwright/test";

import { login, registerStudent, superAdmin, uniqueStudentNo } from "./helpers";

/**
 * Platform paneli (Süper Admin): üniversite ekle → domain ekle → Kent'e Admin ata.
 * Atanan kullanıcı avatar menüsünde "Admin Paneli"ni görür ve fakülte ekler.
 */
test("Süper Admin üniversite ekler, domain ekler, Admin atar; Admin fakülte ekler", async ({ browser, request }) => {
  const stamp = Date.now().toString().slice(-7);
  const password = "Kahve!42x";

  // 0) Admin adayı: Kent'e kayıtlı öğrenci
  const studentCtx = await browser.newContext();
  const student = await studentCtx.newPage();
  const studentEmail = await registerStudent(student, request, { studentNo: uniqueStudentNo(), password, firstName: "Adayadmin" });

  // 1) Süper Admin → üniversite ekle
  const adminCtx = await browser.newContext();
  const page = await adminCtx.newPage();
  const sa = superAdmin();
  await login(page, sa.email, sa.password);
  await page.goto("/panel/platform/universiteler");
  await page.getByRole("link", { name: "Üniversite ekle" }).click();
  await page.getByLabel("Ad", { exact: true }).fill(`E2E Üniversitesi ${stamp}`);
  await page.getByLabel("Şehir").fill("İzmir");
  await page.getByLabel("Mezun doğrulama yolu").selectOption({ label: "Yalnızca belge" });
  await page.getByRole("button", { name: "Üniversiteyi oluştur" }).click();
  await expect(page).toHaveURL(/\/panel\/platform\/universiteler\/\w+$/);
  await expect(page.getByRole("heading", { name: `E2E Üniversitesi ${stamp}` })).toBeVisible();
  await expect(page.getByLabel("Kısa ad (slug)").filter({ visible: true })).toHaveValue(`e2e-universitesi-${stamp}`);

  // 2) Domain ekle (normalize edilir)
  await page.getByLabel("Domain", { exact: true }).filter({ visible: true }).fill(`@OGR.E2E${stamp}.edu.tr`);
  await page.getByRole("button", { name: "Ekle", exact: true }).filter({ visible: true }).click();
  await expect(page.getByText("Domain eklendi.")).toBeVisible();
  await expect(page.getByText(`ogr.e2e${stamp}.edu.tr`, { exact: true })).toBeVisible();

  // Başka üniversitenin kullanıcısı bu üniversiteye Admin olamaz
  await page.getByLabel("Kullanıcının e-postası").filter({ visible: true }).fill(studentEmail);
  await page.getByRole("button", { name: "Admin ata" }).filter({ visible: true }).click();
  await expect(page.getByText(/başka bir üniversiteye kayıtlı/).first()).toBeVisible();

  // 3) Kent'e Admin ata (Adminler sayfasından)
  await page.goto("/panel/platform/adminler");
  await page.getByLabel("Üniversite").selectOption({ label: "İstanbul Kent Üniversitesi" });
  await page.getByLabel("Kullanıcının e-postası").filter({ visible: true }).fill(studentEmail);
  await page.getByRole("button", { name: "Admin ata" }).filter({ visible: true }).click();
  await expect(page.getByText("Admin atandı.")).toBeVisible();
  await expect(page.getByRole("cell", { name: new RegExp(studentEmail) })).toBeVisible();

  // 4) Yeni Admin: avatar menüsü → Admin Paneli → fakülte ekle
  await student.goto("/akis");
  await student.getByRole("button", { name: "Hesap menüsü" }).click();
  await student.getByRole("link", { name: "Admin Paneli" }).click();
  await expect(student).toHaveURL(/\/panel\/admin$/);
  await student.getByRole("link", { name: "Fakülte / Bölüm" }).first().click();
  await student.getByRole("button", { name: "Fakülte ekle" }).click();
  const dialog = student.getByRole("dialog");
  await dialog.getByLabel("Ad (Türkçe)").fill(`E2E Fakültesi ${stamp}`);
  await dialog.getByRole("button", { name: "Ekle" }).click();
  await expect(dialog).toBeHidden();
  await expect(student.getByRole("heading", { name: `E2E Fakültesi ${stamp}` })).toBeVisible();

  // 5) Platform paneline erişemez: 404 arayüzü (streaming nedeniyle HTTP durumu 200 olabilir), menü yok
  await student.goto("/panel/platform");
  await expect(student.getByText(/404|could not be found|bulunamadı/i).first()).toBeVisible();
  await expect(student.getByRole("link", { name: "Üniversite talepleri" })).toHaveCount(0);

  await studentCtx.close();
  await adminCtx.close();
});
