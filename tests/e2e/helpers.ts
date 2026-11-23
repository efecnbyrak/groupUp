import { expect, type APIRequestContext, type Page } from "@playwright/test";

/** e2e ortak yardımcıları. Gereken: Mailpit (docker compose up -d), dev DB'de seed. */
export const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

interface MailpitSummary {
  ID: string;
  Subject: string;
}

export async function waitForMail(request: APIRequestContext, to: string, subject: RegExp): Promise<{ id: string; subject: string; text: string }> {
  for (let i = 0; i < 40; i++) {
    const res = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:"${to}"`, limit: "10" } });
    const { messages } = (await res.json()) as { messages: MailpitSummary[] };
    const hit = messages.find((m) => subject.test(m.Subject));
    if (hit) {
      const full = (await (await request.get(`${MAILPIT}/api/v1/message/${hit.ID}`)).json()) as { Text: string };
      return { id: hit.ID, subject: hit.Subject, text: full.Text };
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Mail gelmedi: ${to} ${subject}`);
}

/** Benzersiz öğrenci numarası (9 hane). */
export function uniqueStudentNo(): string {
  return `9${Date.now().toString().slice(-8)}`;
}

/** Kent Üniversitesi'ne öğrenci kaydı + OTP doğrulama. Sonunda oturum açık, /hesap'tadır. */
export async function registerStudent(page: Page, request: APIRequestContext, opts: { studentNo: string; password: string; firstName?: string }): Promise<string> {
  const email = `${opts.studentNo}@ogr.kent.edu.tr`;
  await page.goto("/kayit");
  await page.getByLabel("Üniversite e-posta adresi").fill(email);
  await page.getByRole("button", { name: "Devam et" }).click();
  await expect(page.getByText("İstanbul Kent Üniversitesi — Öğrenci")).toBeVisible();
  await page.getByLabel("Ad", { exact: true }).fill(opts.firstName ?? "Deneme");
  await page.getByLabel("Soyad", { exact: true }).fill("Kullanıcı");
  await page.getByLabel("Fakülte").selectOption({ label: "Mühendislik ve Doğa Bilimleri Fakültesi" });
  await page.getByLabel("Bölüm").selectOption({ label: "Bilgisayar Mühendisliği" });
  await page.getByLabel("Sınıf").selectOption({ label: "2. sınıf" });
  await page.getByLabel("Telefon").fill("0555 123 45 67");
  await page.getByLabel("Doğum tarihi").fill("2004-05-10");
  await page.getByLabel("Cinsiyet").selectOption({ label: "Belirtmek istemiyorum" });
  await page.getByLabel("Şifre", { exact: true }).fill(opts.password);
  await page.getByLabel("Şifre (tekrar)").fill(opts.password);
  await page.getByLabel(/KVKK aydınlatma metnini/).check();
  await page.getByRole("button", { name: "Hesap oluştur" }).click();
  await expect(page).toHaveURL(/\/dogrula$/);
  const mail = await waitForMail(request, email, /doğrulama kodun/);
  await page.getByLabel("Doğrulama kodu").fill(mail.subject.match(/\d{6}/)![0]);
  await page.getByRole("button", { name: "Doğrula" }).click();
  await expect(page).toHaveURL(/\/hesap$/);
  return email;
}

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/giris");
  await page.getByLabel("E-posta adresi").fill(email);
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).not.toHaveURL(/\/giris/);
}

/** .env'deki lokal Süper Admin (seed). */
export function superAdmin(): { email: string; password: string } {
  try {
    process.loadEnvFile(".env");
  } catch {
    /* CI: ortam değişkenleri zaten tanımlı */
  }
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!email || !password) throw new Error("SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD tanımlı değil");
  return { email, password };
}
