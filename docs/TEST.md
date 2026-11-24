# F12.1 — e2e test durumu ve yapılacaklar

> Bu dosya F12.1 (e2e kritik akışlar) için ara durak. Buradaki maddeleri birlikte tek tek
> ilerleteceğiz — tekrar tekrar otomatik deneme yapılmayacak.

## Tam tanılama turu sonucu (2026-11-24)

Tek seferlik kontrol turu: lint, type-check, vitest, build, e2e (prod sunucu, port 3100),
.env karşılaştırma, git durumu. Hiçbir hata düzeltilmedi, sadece kaydedildi.

### A) Özet tablo

| Kontrol | Durum | Not |
|---|---|---|
| `npm run lint` | ✅ | Hatasız, çıktı boş. |
| `npm run type-check` | ✅ | `next typegen && tsc --noEmit` hatasız. |
| `npm test` (vitest) | ✅ | 43 dosya / 353 test hepsi geçti (28.1s). 1 uyarı: `vitest.config.ts` CJS olarak yükleniyor, Vite native config loader ileride bunu desteklemeyecek. |
| `npm run build` | ✅ | `prisma generate && next build` temiz, uyarı yok. 74 sayfa başarıyla üretildi. |
| `npm run test:e2e` | ❌ | 16 testten 12 geçti, 4 başarısız (ayrıntı B'de). Prod sunucuda (`next start -p 3100`) çalıştırıldı — talimat gereği `npm run db:seed:demo` ile önceki e2e artıkları temizlenmedi (bu komut oturumda izin reddiyle engellendi), bu nedenle registration/tournament başarısızlıkları **önceki çalıştırmalardan kalan artık veriyle karışmış olabilir** — kesin değil, bir sonraki turda önce seed:demo ile temizleyip tek tek doğrulanmalı. |
| `.env` vs `.env.example` | ✅ | Anahtar isimleri birebir aynı, fark yok. |
| `git status` / `diff --stat` | ⚠️ | main, origin'den 1 commit ileride (push edilmemiş). Commit edilmemiş: `docs/ROADMAP.md` (M), `prisma/seed-demo.ts` (M, +3/-0), `docs/TEST.md` (untracked), `tests/e2e/election.spec.ts` (untracked). |

### B) Hata listesi (e2e — tam liste, gruplamadan)

1. **`tests/e2e/election.spec.ts:77`** — zaten bilinen flaky adım (bkz. aşağıdaki "Bilinen açık sorun"). `expect(...).toBe(true)` 180s timeout ile başarısız — oy penceresinin UI'da açık göründüğünü bekleyen koşul gerçekleşmedi. Kategori: flaky e2e (kök neden netleşmedi).
2. **`tests/e2e/registration.spec.ts:99`** ve **`registration.spec.ts:141`** — **GERÇEK BUG bulundu ve teşhis edildi (2026-11-24, takip turu):** `RateLimit` tablosu temizlendikten SONRA bile her iki test farklı noktalarda (sırasıyla "Başvur" ve "Takım kur" butonları hiç görünmeden) timeout'a uğradı. Prod sunucu loglarında (`server3.log`) **30 kez** tekrarlanan gerçek bir sunucu hatası bulundu:
   ```
   ⨯ Error: Functions cannot be passed directly to Client Components unless you
   explicitly expose it by marking it with "use server". Or maybe you meant to
   call this function rather than return it.
     {action: function action, children: ...}
   ```
   **Kök neden:** [src/components/shell/app-header.tsx:125,144](../src/components/shell/app-header.tsx#L125) — `app-header.tsx` bir Server Component (`"use client"` yok), ve bildirim zili için native `<form action={...}>` kullanıyor:
   ```tsx
   <form action={async (fd: FormData) => { await markAllNotificationsReadAction(null, fd); }}>
   ...
   <form action={async (fd: FormData) => { await markNotificationReadAction(null, fd); }}>
   ```
   Bu satırlar ROADMAP F10 notundaki bilinçli tasarımla eşleşiyor ("action imzası (prev, formData) ile native form action imzası (formData) uyuşmadığından ince bir async wrapper sarıldı") — **ama bu wrapper'ın kendisi `'use server'` değil**, Server Component içinde her render'da yeniden oluşturulan düz bir closure. React/Next, Server Component'ten `<form>`'a (client-interaktif) geçen `action` prop'unun gerçek bir Server Action referansı olmasını zorunlu kılıyor; inline wrapper bunu bozuyor.
   Bu yalnızca **okunmamış bir bildirim olduğunda** render edildiği için (`{!n.read && markNotificationReadAction ? <form>… : null}`), önceki testlerde (tournament, club, event, platform, profile, home — hepsi geçti) hiç tetiklenmedi: o akışlarda kullanıcının okunmamış bildirimi yoktu. Registration testlerinde başvuru/takım kararları bildirim ürettiği için zil doluyor → form render oluyor → her render'da sunucu çöküyor → sayfa bozuk kalıyor → "Başvur"/"Takım kur" gibi butonlar hiç görünmüyor.
   **Bu turnuva/rate-limit/artık veriyle ilgisiz, gerçek ve prod'da da (herhangi bir kullanıcı okunmamış bildirimle herhangi bir sayfayı açtığında) tetiklenecek bir üretim hatası.**
4. **`tests/e2e/tournament.spec.ts:12`** (`helpers.ts:62` `login` fonksiyonu içinde) — **ÇÖZÜLDÜ/teşhis edildi (2026-11-24, takip turu):** `npm run db:seed:demo` ile artıklar temizlendikten SONRA bile aynı hata tekrarladı. Error-context çıktısında giriş sayfası gerçek nedeni gösterdi: **"Çok fazla deneme yaptınız. Lütfen 189 dakika sonra tekrar deneyin."** — F2 notundaki bilinen rate-limit davranışı (aynı IP'den saatte ~10'dan fazla e2e girişi `RateLimit` tablosundaki tek anahtarı dolduruyor). `db:seed:demo` bu tabloyu temizlemiyor (yalnızca e2e artık verilerini temizler), bu yüzden sorun devam etti. **Turnuva modülünün kendisiyle hiçbir ilgisi yok** — bugünkü oturumdaki tekrarlı e2e çalıştırmalarının (ilk tam tanılama turu + bu takip turu) kendi kendini kilitlemesi. Gerçek bug DEĞİL.

Diğer kontrollerde (lint/type-check/test/build) sıfır hata — rapor edilecek madde yok.

### C) Bir sonraki oturum için düzeltme prompt'u (kopyala-yapıştır)

```
groupUp F12.1 e2e düzeltme turu. 2026-11-24 tanılama turunda 4 e2e testi başarısız oldu,
diğer her şey (lint/type-check/vitest/build) temizdi. Şu sırayla, EN KRİTİKTEN başlayarak,
TEK TEK ilerle — her adımdan sonra SADECE o adımla ilgili kontrolü çalıştır, tüm e2e setini
tekrar tekrar koşturma:

1. **ÖNCE** `RateLimit` tablosunu temizle (ör. `prisma studio`'da veya bir tek seferlik script
   ile `DELETE FROM "RateLimit"` — ya da 189 dakika bekle). **Teşhis edildi (2026-11-24):**
   `tournament.spec.ts` login hatası turnuva koduyla İLGİSİZ — "Çok fazla deneme yaptınız"
   rate-limit kilidi, bugünkü tekrarlı e2e turlarının kendi kendini kilitlemesi. `db:seed:demo`
   bu tabloyu TEMİZLEMİYOR, sadece e2e artık verilerini temizliyor — ikisi ayrı şeyler.
   RateLimit temizlenince `npx playwright test tests/e2e/tournament.spec.ts` ile tek başına
   doğrula, muhtemelen direkt geçecek — kod tarafında yapılacak bir şey yok.

2. Sonra `npm run db:seed:demo` çalıştır (önceki e2e artıklarını temizler, demo Admin
   hesaplarını sıfırlar) — registration testleri için gerekli.

3. **ÖNCE KOD DÜZELT, SONRA TEST ET:** `src/components/shell/app-header.tsx` satır ~125 ve
   ~144'teki iki `<form action={async (fd) => {...}}>` kullanımını düzelt — inline wrapper
   yerine gerçek bir server action gerekiyor. İki seçenek: (a) `markNotificationReadAction`/
   `markAllNotificationsReadAction`'ın imzasını native form action'ın beklediği
   `(formData: FormData) => Promise<void>` şekline getirecek ayrı, modülde `'use server'`
   işaretli bir sarmalayıcı fonksiyon tanımla (`notification/actions.ts`'te,
   `markNotificationReadFormAction` gibi) ve onu prop olarak geçir — inline closure OLMASIN;
   (b) ya da `app-header.tsx`'in bu kısmını `'use client'` alt bileşene taşı ve orada
   `useFormAction`/mevcut `run()` deseniyle çağır (F10'daki diğer action çağırma deseniyle
   aynı). (a) daha az değişiklik gerektirir. Düzelttikten sonra SADECE
   `npm run type-check` ve `npm run build` çalıştır (hata yoksa devam et, tüm testleri
   koşturma).

4. `tests/e2e/registration.spec.ts` içindeki 2 başarısızlığı (satır 99 ve 141) tek başına
   çalıştırarak doğrula: `npx playwright test tests/e2e/registration.spec.ts`. Adım 3'teki
   düzeltme kök nedeni çözdüyse ikisi de geçmeli.

4. `tests/e2e/election.spec.ts` flaky adımı (docs/TEST.md'deki "Bilinen açık sorun" bölümü)
   — bu zaten bilinen ve kullanıcıyla birlikte ele alınacak bir sorun, otomatik tekrar
   deneme YAPMA. TEST.md'deki "Sırada" maddesindeki izole repro planını uygula (tek başına
   `/kulupler/kent-spor`'u birkaç kez `goto` ile açıp banner rect'ini loglayan minik script).

5. Her düzeltmeden sonra SADECE değiştirdiğin alanın testini çalıştır (örn. registration
   düzelttiysen `npx playwright test tests/e2e/registration.spec.ts`, tüm e2e setini değil).

6. TÜM düzeltmeler bitince, sırayla bir kez çalıştır:
   `npm run lint && npm run type-check && npm test && npm run build`
   Hepsi yeşilse, o zaman (ve SADECE o zaman) tam e2e setini bir kez çalıştır
   (`npm run db:seed:demo` ile temizledikten sonra `npm run test:e2e`) ve bana haber ver.
```

### D) Değerlendirme

Çekirdek kod kalitesi (lint/type/unit test/build) tamamen temiz — F11 sonrası regresyon yok.
e2e tarafında 1 bilinen flaky (election) + 3 yeni başarısızlık var; bunların gerçek bug mu
yoksa test ortamı/artık veri kaynaklı mı olduğu netleşmedi (seed:demo bu oturumda
çalıştırılamadı). Bir sonraki oturum önce ortamı temizleyip teşhisi netleştirmeli.

### E) Çözüldü (2026-11-24, takip turu 2)

**B.2'deki "use server" bug'ı düzeltildi.** Seçenek (a) uygulandı:

- `src/modules/notification/actions.ts`'e iki yeni `'use server'` sarmalayıcı eklendi:
  `markNotificationReadFormAction(formData)` / `markAllNotificationsReadFormAction(formData)`
  — ikisi de mevcut `(prev, formData)` imzalı action'ı `(null, formData)` ile çağırıp
  `Promise<void>` döndürüyor. Mevcut `markNotificationReadAction`/`markAllNotificationsReadAction`
  imzaları DEĞİŞMEDİ (başka yerde kullanılmıyorlardı, ama yine de dokunulmadı).
- `src/modules/notification/index.ts` yeni iki action'ı da re-export ediyor.
- `src/components/shell/app-header.tsx`: `NotificationActionResult`/`NotificationAction` tipleri
  kaldırıldı, yerine `NotificationFormAction = (formData: FormData) => Promise<void>` geldi.
  Satır ~125/~144'teki inline `async (fd) => { await action(null, fd); }` closure'ları
  `<form action={markAllNotificationsReadFormAction}>` / `<form action={markNotificationReadFormAction}>`
  ile değiştirildi (inline wrapper kalmadı). Prop adları da yeni action adlarıyla hizalandı.
- `src/components/shell/index.ts` ve `app/(app)/layout.tsx` yeni isimlere güncellendi.

**Ek bulgu:** Fix uygulanınca `registration.spec.ts:127` (`takım: kur, kodla katıl...`) testi
strict-mode ihlaliyle başarısız oldu — bildirim zili artık çökmeden render olduğundan,
"E2E Takımı" metni hem sayfa içeriğinde hem bildirim panelindeki (gizli) `<p>` body'sinde
eşleşti. Bu, kök bug'ın bir **semptomuydu** (zil hep çöktüğü için bu çakışma hiç görünür
olmamıştı), gerçek bir regresyon değil. `tests/e2e/registration.spec.ts:127`'deki
`captain.getByText("E2E Takımı")` → `captain.locator("#icerik").getByText("E2E Takımı")`
yapılarak ana içerik alanına (`#icerik` landmark) daraltıldı.

**Doğrulama sonucu:**
- `npm run type-check` ✅, `npm run build` ✅ (uyarısız).
- `npx playwright test tests/e2e/registration.spec.ts` — 2 worker'la çalıştırıldığında
  bireysel test 240s timeout'a uğradı; **`--workers=1` ile tekrar edilince ikisi de geçti**
  (37.3s + 18.4s). Kök neden: iki test paylaşılan demo hesaplarını (`demo.ogrenci04/05`,
  `demo.gorevli`, `demo.uye`, `demo.baskan`) paralel worker'larda aynı anda kullanıyor —
  worker çakışması, kod tarafında bir şey değil. Playwright config'teki `workers` ayarı
  F5 notunda zaten "6 GB RAM'de dev sunucusu OOM'u" sebebiyle 3'e düşürülmüştü; bu iki test
  özelinde paylaşılan hesap çakışması ayrı bir konu — ileride registration.spec.ts'e özel
  hesap ayrımı (her teste kendi e2e kullanıcısı) düşünülebilir, şimdilik kapsam dışı.
- `npm run lint && npm run type-check && npm test && npm run build` sırayla bir kez
  çalıştırıldı — hepsi ✅ (lint hatasız, type-check hatasız, 43 dosya/353 test geçti, build
  74 sayfa temiz).

**Kapsam dışı (dokunulmadı):** `election.spec.ts`'teki bilinen flaky adım (yukarıdaki "Bilinen
açık sorun"), `tournament.spec.ts` rate-limit konusu (B.4'te zaten çözümlü/kod dışı olarak
not edilmişti, bu turda tekrar koşturulmadı).


## Şu ana kadar yapılanlar

- [x] `tests/e2e/election.spec.ts` yazıldı: seçim oluştur → adaylık → oylama → sonuç onayı →
      başkan değişir (F11'in Playwright boşluğunu kapatmak için).
- [x] `prisma/seed-demo.ts`'e e2e seçim artığı temizliği eklendi (`E2E Seçimi ` önekiyle, diğer
      e2e temizlikleriyle aynı desen).
- [x] Testi `npm run dev` (Turbopack) üzerinde birden fazla kez denedim — dev sunucusu uzun süren
      (dakikalarca, onlarca navigasyonlu) bu testte kararsızlaştı (bir noktadan sonra sayfalar
      boş/hata overlay'i döndürdü). **Sonuç: bu testi dev sunucusuna karşı çalıştırmayın.**
- [x] `npm run build && npx next start -p 3100` (prod sunucu) ile denendiğinde dev sunucusu
      sorunu ortadan kalktı, test akışın büyük kısmından geçti (seçim oluşturma, adaylık, admin
      onayı hep başarılı).

## Çözüldü (2026-11-24, takip turu 3) — adım 4/6 hydration-timing hatası

**Kök neden bulundu ve düzeltildi.** İzole repro: `/kulupler/kent-spor`'u VOTING durumunda bir
seçimle (DB'ye doğrudan yazılarak) art arda `goto` ile açıp banner başlığının
`getBoundingClientRect()`'ini ve ebeveyn zincirinin `display` değerini loglayan minik bir script
(bu oturumda yazılıp çalıştırıldı, repo'da kalıcı değil).

- Element DOM'da her zaman doğru render ediliyordu (count:1, text doğru) — ama `goto`'nun `load`
  event'i çözüldüğü anda, h2'nin **beş seviye üst ebeveyni `display:none` sınıfsız bir `<div>`**
  (Next 16 PPR/`cacheComponents`'ın bu route için ürettiği statik kabuk + dinamik parça sınırı —
  React'ın hidden `<Activity>` boundary'si) idi. Bu sarmalayıcı yalnızca **client-side hydration
  tamamlandıktan sonra** (bu ortamda ~1.0–1.5s) görünür hale geliyordu — `page.waitForTimeout(1500)`
  sonrası rect her zaman doğru boyuta (`499×21`) dönüyordu, **tutarlı/deterministik bir hydration
  yarışıydı, rastgele flaky değildi.**
- Eski kod `load` event'i döndüğü anda **tek seferlik** `isVisible()` çağırıyordu — hydration'ı
  beklemeden "false" dönüyordu. 5s'lik poll aralığı genelde bunu bir sonraki turda yakalıyordu, ama
  bazı turlarda (yavaş render/ağır yük) hydration gecikmesi 5s'yi aşınca test 180s/300s'lik üst
  limitte tıkanıyordu.
- **Fix:** `tests/e2e/election.spec.ts` adım 4 ve adım 6 — `expect.poll` içindeki tek seferlik
  `.isVisible()` çağrısı, kendi içinde (poll aralığından bağımsız, 10s) retry eden
  `await expect(locator).toBeVisible({ timeout: 10_000 })` + try/catch'e çevrildi. Bu, hydration'ı
  bekler ve gerçek "VOTING/CLOSED henüz değil" durumuyla "hydration henüz bitmedi" durumunu
  birbirinden ayırır. **Uygulama kodunda değişiklik yok** — sorun yalnızca testin ölçüm anındaydı.
- Doğrulama: `next build && next start -p 3100`'e karşı tam akış (`npx playwright test
  tests/e2e/election.spec.ts --workers=1`) **1 geçti** (ilk denemede adım 4'ü aştı ama adım 6'da
  aynı desenle tıkandı — oraya da aynı fix uygulandı; ikinci denemede tamamı geçti, 5.9dk).
- **Genel ders (F12.1'in kalan kısmı için de geçerli):** bu uygulamada `page.goto()` sonrası
  `load` event'i hydration'ın bittiği anlamına gelmiyor (PPR nedeniyle); yeni e2e adımlarında
  `goto`'dan hemen sonra tek seferlik `isVisible()`/`isHidden()` KULLANILMAMALI, her zaman kendi
  içinde retry eden `expect(locator).toBeVisible()`/`toBeHidden()` kullanılmalı.

## Sırada (birlikte ilerlenecek)

- [x] F12.1'in geri kalanı: e2e kapsamı gözden geçirildi, `club.spec.ts`/`tournament.spec.ts`'e
      ek senaryo eklendi, tam takım `--workers=1` ile 16/16 yeşil (bkz. ROADMAP "takip turu 7").
      Erişilebilirlik denetimi (WCAG 2.2 AA) yapıldı. Lighthouse bu sandbox'ta çalıştırılamadı.
- [ ] F12.2: Güvenlik başlıkları, CSP, rate limit gözden geçirme.
- [ ] F12.3: KVKK — metin sayfaları, veri dışa aktarma, anonimleştirme.
- [ ] F12.4: R2 + SES + DeepL canlı provider'ları, Vercel deploy.

## Notlar / hatırlatmalar

- e2e DB artıklarını temizlemek için: `npm run db:seed:demo` (hem bu testin hem diğerlerinin
  bıraktığı E2E-önekli kayıtları temizler).
- Prod sunucuyu elle başlatmak gerekirse: `npm run build && npx next start -p 3100` (Playwright
  config `reuseExistingServer` olduğu için zaten ayakta olan sunucuyu kullanır).
- Token/süre tasarrufu için: bu test tek bir çalıştırması gerçek zamanlı pencere beklemeleri
  yüzünden ~3-5 dakika sürüyor. Değişiklik sonrası tekrar çalıştırmadan önce mantığı statik olarak
  gözden geçir, sadece gerektiğinde çalıştır.
