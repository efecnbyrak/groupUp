import { expect, test } from "@playwright/test";
import sharp from "sharp";

import { registerStudent, uniqueStudentNo, waitForMail } from "./helpers";

/**
 * Profil düzenle + avatar yükle → aktif oturumlar → hesap sil (Mailpit linki) → giriş başarısız.
 */
test("profil düzenleme, avatar, oturumlar ve hesap silme", async ({ page, request }) => {
  const password = "Kahve!42x";
  const email = await registerStudent(page, request, { studentNo: uniqueStudentNo(), password, firstName: "Profilci" });
  const visible = <T extends { filter: (o: { visible: boolean }) => T }>(l: T) => l.filter({ visible: true });

  // 1) Profil düzenle
  await page.goto("/profil/duzenle");
  await visible(page.getByLabel("Ad", { exact: true })).fill("Zeynep");
  await visible(page.getByLabel("Hakkımda")).fill("Satranç ve e-spor meraklısı.");
  await visible(page.getByLabel("Fakülte / bölüm")).selectOption({ label: "Yazılım Mühendisliği" });
  await visible(page.getByRole("button", { name: "Kaydet" })).click();
  await expect(visible(page.getByText("Profilin güncellendi."))).toBeVisible();

  // 2) Avatar yükle (gerçek PNG → sunucuda 256×256 WebP)
  const png = await sharp({ create: { width: 600, height: 400, channels: 3, background: { r: 20, g: 120, b: 220 } } }).png().toBuffer();
  await visible(page.getByLabel("Fotoğraf seç")).setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: png });
  await visible(page.getByRole("button", { name: "Yükle" })).click();
  await expect(visible(page.getByText("Profil fotoğrafın güncellendi."))).toBeVisible();

  await page.goto("/profil");
  await expect(visible(page.getByText("Zeynep Kullanıcı")).first()).toBeVisible();
  await expect(visible(page.getByText("Satranç ve e-spor meraklısı."))).toBeVisible();
  await expect(visible(page.getByText("Yazılım Mühendisliği"))).toBeVisible();
  const avatarSrc = await visible(page.locator("main img")).first().getAttribute("src");
  expect(avatarSrc).toMatch(/^\/api\/files\/avatars\/.+\.webp$/);
  const file = await request.get(avatarSrc!);
  expect(file.headers()["content-type"]).toBe("image/webp");
  const meta = await sharp(await file.body()).metadata();
  expect([meta.width, meta.height]).toEqual([256, 256]);

  // 3) Aktif oturumlar
  await page.goto("/hesap/oturumlar");
  await expect(visible(page.getByText("Bu cihaz"))).toBeVisible();

  // 4) Hesap sil → mail → onay
  await page.goto("/hesap/sil");
  await visible(page.getByLabel("Şifre", { exact: true })).fill(password);
  await visible(page.getByRole("button", { name: "Silme bağlantısı gönder" })).click();
  await expect(visible(page.getByText(/kutuyu işaretle/).first())).toBeVisible();
  await visible(page.getByLabel(/kalıcı olarak silineceğini anlıyorum/)).check();
  await visible(page.getByLabel("Şifre", { exact: true })).fill(password);
  await visible(page.getByRole("button", { name: "Silme bağlantısı gönder" })).click();
  await expect(visible(page.getByText(/onay bağlantısı gönderdik/))).toBeVisible();

  const mail = await waitForMail(request, email, /silme onayı/);
  const link = mail.text.match(/https?:\/\/\S+\/hesap\/sil\/onay\?token=[\w%-]+/)?.[0];
  expect(link).toBeTruthy();
  await page.goto(new URL(link!).pathname + new URL(link!).search);
  await visible(page.getByRole("button", { name: "Hesabımı kalıcı olarak sil" })).click();
  await expect(page).toHaveURL(/\/giris\?silindi=1$/);
  await expect(visible(page.getByText("Hesabın silindi."))).toBeVisible();

  // 5) Eski bilgilerle giriş yapılamaz; link tekrar kullanılamaz
  await visible(page.getByLabel("E-posta adresi")).fill(email);
  await visible(page.getByLabel("Şifre", { exact: true })).fill(password);
  await visible(page.getByRole("button", { name: "Giriş yap" })).click();
  await expect(visible(page.getByText("E-posta veya şifre hatalı."))).toBeVisible();
  await page.goto(new URL(link!).pathname + new URL(link!).search);
  await expect(visible(page.getByText(/geçersiz veya süresi dolmuş/))).toBeVisible();
});
