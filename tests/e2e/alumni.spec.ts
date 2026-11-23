import { expect, test } from "@playwright/test";

import { demoAdmin, login, waitForMail } from "./helpers";

/**
 * Manuel mezun yolu (AUTH-EMAIL §6): kişisel mail → üniversite seç → OTP → belge yükle → bekleme ekranı →
 * Admin gerekçeyle reddeder (mail) → yeniden yükleme → Admin onaylar (mail) → hesap aktif.
 * Önkoşul: `db:seed:demo` (demo Admin), Mailpit açık.
 */
test("manuel mezun kaydı, belge, ret → yeniden yükleme → onay", async ({ page, request, browser }) => {
  test.setTimeout(150_000);
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
  await expect(visible(page.getByText("Yalnızca PDF, JPG, PNG veya WEBP yükleyebilirsiniz."))).toBeVisible();
  await visible(page.getByLabel("Belge")).setInputFiles({ name: "diploma.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\n%%EOF\n") });
  await visible(page.getByRole("button", { name: "Belgeyi gönder" })).click();
  await expect(visible(page.getByText("Belgen inceleniyor"))).toBeVisible();
  await expect(visible(page.getByText(/Gönderilen: diploma\.pdf/))).toBeVisible();

  // Admin: mezun doğrulama → incele → gerekçeli ret
  const reason = "Belge okunaklı değil, lütfen net bir kopya yükleyin.";
  const admin = await (await browser.newContext()).newPage();
  const a = demoAdmin();
  await login(admin, a.email, a.password);
  await admin.goto("/panel/admin/mezun-dogrulama");
  await admin.getByRole("row", { name: new RegExp(email.replace(".", "\\.")) }).getByRole("link", { name: "İncele ve karar ver" }).click();
  await expect(admin.getByRole("heading", { name: "Mezun doğrulama" })).toBeVisible();
  await admin.getByRole("button", { name: "Reddet" }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByLabel("Ret gerekçesi").fill("kısa");
  await dialog.getByRole("button", { name: "Reddet" }).click();
  await expect(dialog.getByText("Gerekçe en az 10 karakter olmalı.")).toBeVisible();
  await dialog.getByLabel("Ret gerekçesi").fill(reason);
  await dialog.getByRole("button", { name: "Reddet" }).click();
  await expect(admin.getByText(/tarihinde reddedildi/)).toBeVisible();
  const rejected = await waitForMail(request, email, /Mezun belgen onaylanmadı/);
  expect(rejected.text).toContain(reason);

  // Kullanıcı: gerekçeyi görür, yeniden yükler
  await page.goto("/mezun-dogrulama");
  await expect(visible(page.getByText(`Gerekçe: ${reason}`))).toBeVisible();
  await visible(page.getByLabel("Belge")).setInputFiles({ name: "diploma-net.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\n%%EOF\n") });
  await visible(page.getByRole("button", { name: "Yeni belge gönder" })).click();
  await expect(visible(page.getByText("Belgen inceleniyor"))).toBeVisible();

  // Admin: yeni talebi onaylar → hesap aktif
  await admin.goto("/panel/admin/mezun-dogrulama");
  await admin.getByRole("row", { name: new RegExp(email.replace(".", "\\.")) }).getByRole("link", { name: "İncele ve karar ver" }).click();
  await admin.getByRole("button", { name: "Onayla" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Onayla" }).click();
  await expect(admin.getByText(/tarihinde onaylandı/)).toBeVisible();
  await waitForMail(request, email, /Mezun hesabın onaylandı/);
  await page.goto("/akis");
  await expect(page).toHaveURL(/\/akis$/);
});
