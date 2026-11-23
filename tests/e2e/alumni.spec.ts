import { expect, test } from "@playwright/test";

import { waitForMail } from "./helpers";

/** Manuel mezun yolu (AUTH-EMAIL §6): kişisel mail → üniversite seç → OTP → belge yükle → bekleme ekranı. */
test("manuel mezun kaydı, belge yükleme ve bekleme ekranı", async ({ page, request }) => {
  const email = `mezun${Date.now().toString().slice(-8)}@kisisel-e2e.com`;
  const password = "Deniz#77y";
  const visible = <T extends { filter: (o: { visible: boolean }) => T }>(l: T) => l.filter({ visible: true });

  await page.goto("/kayit");
  await page.getByLabel("Üniversite e-posta adresi").fill(email);
  await page.getByRole("button", { name: "Devam et" }).click();
  await visible(page.getByLabel("Mezun olduğun üniversite")).selectOption({ label: "İstanbul Kent Üniversitesi" });
  await visible(page.getByRole("button", { name: "Mezun olarak devam et" })).click();
  await expect(visible(page.getByText("İstanbul Kent Üniversitesi — Mezun"))).toBeVisible();

  await visible(page.getByLabel("Öğrenci numarası")).fill("20150042");
  await visible(page.getByLabel("Ad", { exact: true })).fill("Mezun");
  await visible(page.getByLabel("Soyad", { exact: true })).fill("Deneme");
  await visible(page.getByLabel("Fakülte")).selectOption({ label: "Mühendislik ve Doğa Bilimleri Fakültesi" });
  await visible(page.getByLabel("Bölüm")).selectOption({ label: "Bilgisayar Mühendisliği" });
  await visible(page.getByLabel("Mezuniyet yılı")).fill("2019");
  await visible(page.getByLabel("Telefon")).fill("0555 123 45 67");
  await visible(page.getByLabel("Doğum tarihi")).fill("1996-05-10");
  await visible(page.getByLabel("Cinsiyet")).selectOption({ label: "Belirtmek istemiyorum" });
  await visible(page.getByLabel("Şifre", { exact: true })).fill(password);
  await visible(page.getByLabel("Şifre (tekrar)")).fill(password);
  await visible(page.getByLabel(/KVKK aydınlatma metnini/)).check();
  await visible(page.getByRole("button", { name: "Hesap oluştur" })).click();

  await expect(page).toHaveURL(/\/dogrula$/);
  const mail = await waitForMail(request, email, /doğrulama kodun/);
  await page.getByLabel("Doğrulama kodu").fill(mail.subject.match(/\d{6}/)![0]);
  await page.getByRole("button", { name: "Doğrula" }).click();

  // Hesap henüz aktif değil → mezun doğrulama sayfası; diğer sayfalar kapalı
  await expect(page).toHaveURL(/\/mezun-dogrulama$/);
  await page.goto("/akis");
  await expect(page).toHaveURL(/\/mezun-dogrulama$/);

  // Sahte PDF reddedilir, gerçek PDF kabul edilir
  await visible(page.getByLabel("Belge")).setInputFiles({ name: "diploma.pdf", mimeType: "application/pdf", buffer: Buffer.from("<html>sahte</html>") });
  await visible(page.getByRole("button", { name: "Belgeyi gönder" })).click();
  await expect(visible(page.getByText("Bu dosya türü desteklenmiyor."))).toBeVisible();
  await visible(page.getByLabel("Belge")).setInputFiles({ name: "diploma.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\n%%EOF\n") });
  await visible(page.getByRole("button", { name: "Belgeyi gönder" })).click();
  await expect(visible(page.getByText("Belgen inceleniyor"))).toBeVisible();
  await expect(visible(page.getByText(/Gönderilen: diploma\.pdf/))).toBeVisible();
});
