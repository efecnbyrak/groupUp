import { expect, test } from "@playwright/test";

import { uniqueStudentNo, waitForMail } from "./helpers";

/**
 * Uçtan uca kimlik akışı (AUTH-EMAIL §1–3, §7): kayıt → Mailpit'ten OTP → doğrula → çıkış →
 * şifremi unuttum → Mailpit'ten link → yeni şifre → giriş.
 * Gereken: Mailpit (docker compose up -d), dev DB'de seed (İstanbul Kent Üniversitesi).
 */
test("kayıt → doğrulama → çıkış → şifre sıfırlama → giriş", async ({ page, request }) => {
  const studentNo = uniqueStudentNo();
  const email = `${studentNo}@ogr.kent.edu.tr`;
  const password = "Kahve!42x";
  const newPassword = "Deniz#77y";

  // 1) Kayıt adım 1: domain çözümleme
  await page.goto("/kayit");
  await page.getByLabel("Üniversite e-posta adresi").fill(email);
  await page.getByRole("button", { name: "Devam et" }).click();
  await expect(page.getByText("İstanbul Kent Üniversitesi — Öğrenci")).toBeVisible();

  // 2) Profil formu
  await expect(page.getByLabel("Öğrenci numarası")).toHaveValue(studentNo);
  await page.getByLabel("Ad", { exact: true }).fill("Deneme");
  await page.getByLabel("Soyad", { exact: true }).fill("Kullanıcı");
  await page.getByLabel("Fakülte").selectOption({ label: "Mühendislik ve Doğa Bilimleri Fakültesi" });
  await page.getByLabel("Bölüm").selectOption({ label: "Bilgisayar Mühendisliği" });
  await page.getByLabel("Sınıf").selectOption({ label: "2. sınıf" });
  await page.getByLabel("Telefon").fill("0555 123 45 67");
  await page.getByLabel("Doğum tarihi").fill("2004-05-10");
  await page.getByLabel("Cinsiyet").selectOption({ label: "Belirtmek istemiyorum" });
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await page.getByLabel("Şifre (tekrar)").fill(password);
  await page.getByLabel(/KVKK aydınlatma metnini/).check();
  await page.getByRole("button", { name: "Hesap oluştur" }).click();

  // 3) OTP
  await expect(page).toHaveURL(/\/dogrula$/);
  await expect(page.getByText(email).filter({ visible: true })).toBeVisible();
  const verifyMail = await waitForMail(request, email, /doğrulama kodun/);
  const code = verifyMail.subject.match(/\d{6}/)?.[0];
  expect(code).toBeTruthy();
  await page.getByLabel("Doğrulama kodu").fill(code!);
  await page.getByRole("button", { name: "Doğrula" }).click();

  // 4) Hesap sayfası → çıkış
  await expect(page).toHaveURL(/\/hesap$/);
  await expect(page.getByText(`${email} olarak giriş yaptın.`)).toBeVisible();
  await page.getByRole("button", { name: "Çıkış yap" }).click();
  await expect(page).toHaveURL(/\/giris$/);

  // Korunan sayfa oturumsuz → giriş
  await page.goto("/hesap");
  await expect(page).toHaveURL(/\/giris\?next=%2Fhesap$/);

  // 5) Şifremi unuttum → Mailpit'ten link
  await page.goto("/sifremi-unuttum");
  await page.getByLabel("E-posta adresi").fill(email);
  await page.getByRole("button", { name: "Bağlantı gönder" }).click();
  await expect(page.getByRole("status")).toContainText("sıfırlama bağlantısı gönderdik");
  const resetMail = await waitForMail(request, email, /şifre sıfırlama/);
  const token = resetMail.text.match(/token=([\w%-]+)/)?.[1];
  expect(token).toBeTruthy();

  // 6) Yeni şifre
  await page.goto(`/sifre-sifirla?token=${token}`);
  await page.getByLabel("Yeni şifre").fill(newPassword);
  await page.getByLabel("Şifre (tekrar)").fill(newPassword);
  await page.getByRole("button", { name: "Şifreyi güncelle" }).click();
  await expect(page).toHaveURL(/\/giris\?sifirlandi=1$/);
  await waitForMail(request, email, /şifren değiştirildi/);

  // 7) Eski şifre reddedilir, yenisiyle giriş
  await page.getByLabel("E-posta adresi").fill(email);
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page.getByText("E-posta veya şifre hatalı.")).toBeVisible();

  await page.getByLabel("Şifre", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/hesap$/);
});
