import { expect, test } from "@playwright/test";

import { toIstanbulLocalInput } from "@/lib/dates";

import { demoAdmin, login } from "./helpers";

/**
 * F11: Admin seçim oluşturur → öğrenci aday olur → Admin adayı onaylar → oy penceresi açılınca
 * üyeler oy verir → oy kapanınca Admin kuyruğunda "Seçim sonucu" talebi → onaylanınca kulübün
 * yeni başkanı değişir. ELECTIONS §2/§3, F11 notu (ROADMAP.md): bu ekranlar yalnızca duman testinden
 * geçmişti, burada ilk kez gerçek tarayıcıda uçtan uca doğrulanıyor.
 * Önkoşul: `db:seed:demo` (Kent Spor Kulübü — demo.baskan başkan, demo.uye/demo.gorevli üye).
 */
test("seçim oluştur → adaylık → oylama → sonuç onayı → başkan değişir", async ({ browser, request }) => {
  test.setTimeout(600_000);
  const ctx = async () => (await browser.newContext()).newPage();
  const { password } = demoAdmin();
  // Tarayıcı önbelleği aynı adrese tekrar `goto` ile gidişte eski sayfayı verebilir; zaman tabanlı
  // durum geçişleri (lazy sync) her navigasyonda taze sunucu render'ı gerektirir.
  const fresh = (path: string) => `${path}?_=${Date.now()}`;

  const admin = await ctx();
  await login(admin, "demo.admin@ogr.kent.edu.tr", password);
  const candidate = await ctx();
  await login(candidate, "demo.uye@ogr.kent.edu.tr", password);
  const voter = await ctx();
  await login(voter, "demo.gorevli@ogr.kent.edu.tr", password);

  // Pencereler: adaylık hemen açık, oylama ~2dk sonra açılır, ~6dk sonra kapanır (geniş pay).
  const now = Date.now();
  const stamp = Date.now().toString().slice(-7);
  const title = `E2E Seçimi ${stamp}`;
  const candidacyOpensAt = new Date(now - 10 * 60_000);
  const candidacyClosesAt = new Date(now + 2 * 60_000);
  const votingOpensAt = candidacyClosesAt;
  const votingClosesAt = new Date(now + 6 * 60_000);

  // 1) Admin: seçim oluştur (Kent Spor Kulübü).
  await admin.goto(fresh("/panel/admin/secimler"));
  await admin.getByRole("button", { name: "Seçim oluştur" }).click();
  const create = admin.getByRole("dialog");
  await create.getByLabel("Kulüp").selectOption({ label: "Kent Spor Kulübü" });
  await create.getByLabel("Seçim başlığı").fill(title);
  await create.getByLabel("Adaylık başlangıcı").fill(toIstanbulLocalInput(candidacyOpensAt));
  await create.getByLabel("Adaylık bitişi").fill(toIstanbulLocalInput(candidacyClosesAt));
  await create.getByLabel("Oy başlangıcı").fill(toIstanbulLocalInput(votingOpensAt));
  await create.getByLabel("Oy bitişi").fill(toIstanbulLocalInput(votingClosesAt));
  await create.getByRole("button", { name: "Oluştur" }).click();
  await expect(admin.getByRole("heading", { name: new RegExp(title) }).filter({ visible: true })).toBeVisible({ timeout: 15_000 });

  // 2) Üye: kulüp sayfasında adaylık bandı görünür, aday olur.
  await candidate.goto(fresh("/kulupler/kent-spor"));
  await expect(candidate.getByText("Başkanlık seçimi: adaylık açık").filter({ visible: true })).toBeVisible();
  await candidate.getByLabel("Adaylık metni").fill("Kulübü daha ileriye taşımak için adayım.");
  await candidate.getByRole("button", { name: "Aday ol" }).click();
  await expect(candidate.getByText("Adaylığın gönderildi, Admin onayını bekliyor.").filter({ visible: true })).toBeVisible();

  // 3) Admin: adayı onaylar.
  await admin.goto(fresh("/panel/admin/secimler"));
  await expect(admin.getByText("Onay bekliyor").filter({ visible: true })).toBeVisible();
  await admin.getByRole("button", { name: "Onayla" }).filter({ visible: true }).first().click();
  await admin.getByRole("dialog").getByRole("button", { name: "Onayla" }).click();
  await expect(admin.getByText("Onay bekliyor").filter({ visible: true })).toHaveCount(0);

  // 4) Oy penceresi açılana kadar bekle, sayfayı yenileyerek zaman tabanlı geçişi tetikle.
  // ÇÖZÜLDÜ (bkz. docs/TEST.md "Bilinen açık sorun"): DB'de status doğru zamanda VOTING'e geçiyor
  // ve HTML'de banner her zaman doğru render ediliyor — ama `goto` sonrası `load` event'i, Next 16
  // PPR'ın statik kabuk + dinamik parça sınırını (bir `display:none` sarmalayıcı) client hydration
  // tamamlanmadan ateşliyor; sarmalayıcı yalnızca hydration bitince (bu ortamda ~1-1.5s) görünür
  // hale geliyor. Tek seferlik `isVisible()` bu pencereyi yakalayıp false dönebiliyordu.
  // `toBeVisible()` kendi içinde (poll aralığından bağımsız) retry ettiği için hydration'ı bekler.
  await expect
    .poll(
      async () => {
        await voter.goto(fresh("/kulupler/kent-spor"));
        try {
          await expect(voter.getByText("Başkanlık seçimi: oylama açık").filter({ visible: true })).toBeVisible({ timeout: 10_000 });
          return true;
        } catch {
          return false;
        }
      },
      { timeout: 180_000, intervals: [5_000] },
    )
    .toBe(true);

  // 5) İki üye de "Evet" oyu verir (tek adaylık → Evet/Hayır).
  for (const p of [candidate, voter]) {
    await p.goto(fresh("/kulupler/kent-spor"));
    await p.getByRole("button", { name: "Evet" }).filter({ visible: true }).click();
    await p.getByRole("dialog").getByRole("button", { name: "Onayla" }).click();
    await expect(p.getByText("Oyunu kullandın. Sonuçlar oy kapandıktan sonra görünür.").filter({ visible: true })).toBeVisible();
  }

  // 6) Oy kapanana kadar bekle (lazy sync CLOSED'a geçirir).
  // Adım 4'teki hydration-timing hatasıyla aynı sebep (bkz. docs/TEST.md) — `toBeVisible()`
  // kendi içinde retry ettiği için hydration'ı bekler, tek seferlik `isVisible()` beklemez.
  await expect
    .poll(
      async () => {
        await admin.goto(fresh("/panel/admin/secimler"));
        try {
          await expect(admin.getByText("Oylama bitti").filter({ visible: true })).toBeVisible({ timeout: 10_000 });
          return true;
        } catch {
          return false;
        }
      },
      { timeout: 300_000, intervals: [5_000] },
    )
    .toBe(true);

  // 7) Saatlik cron: CLOSED seçimi "Seçim sonucu" talebine dönüştürür.
  const cronRes = await request.get("/api/cron/hourly", { headers: { authorization: `Bearer ${cronSecret()}` } });
  expect(cronRes.ok()).toBe(true);

  // 8) Admin: onay kuyruğunda "Seçim sonucu" → onayla.
  await admin.goto(fresh("/panel/admin/onay-kuyrugu"));
  await admin.getByRole("row", { name: /Kent Spor Kulübü/ }).filter({ visible: true }).getByRole("link", { name: "Seçim sonucu" }).click();
  await expect(admin.getByRole("heading", { name: "Seçim sonucu" }).filter({ visible: true })).toBeVisible();
  await admin.getByRole("button", { name: "Onayla" }).filter({ visible: true }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Onayla" }).click();
  await expect(admin.getByText(/tarihinde onaylandı/).filter({ visible: true })).toBeVisible();

  // 9) Kulübün başkanı değişti, kulüp sayfasında sonuç bandı görünür.
  await voter.goto(fresh("/kulupler/kent-spor"));
  await expect(voter.getByText(/Yeni başkan: Can Aydın/).filter({ visible: true })).toBeVisible();
  await expect(voter.getByText("Can Aydın").filter({ visible: true }).first()).toBeVisible();
});

function cronSecret(): string {
  try {
    process.loadEnvFile(".env");
  } catch {
    /* CI: ortam değişkenleri zaten tanımlı */
  }
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET tanımlı değil");
  return secret;
}
