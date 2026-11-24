# Canlıya Çıkış ve Bekleyen Altyapı

> Şu an **yalnızca lokal** çalışılıyor. Bu dosya canlıya çıkışta yapılacakları ve henüz kurulmamış servisleri tutar. Karar verilmemiş maddeler "Öneri" olarak işaretlidir.

## 1. Henüz kurulmamış / açılmamış (kullanıcının yapacakları)
- [ ] **Vercel hesabı + proje** — Öneri: Hobby plan ticari olmayan kullanım içindir; üniversite kulüp projesi için uygunluğu kontrol edilmeli, gerekirse Pro.
- [ ] **Canlı PostgreSQL** — Öneri: Neon (ücretsiz katman, serverless sürücü + pooling) veya Supabase (yalnızca Postgres olarak). Bölge: Frankfurt (`eu-central-1`) — Vercel fonksiyon bölgesi aynı (`fra1`).
- [ ] **Cloudflare R2** — iki bucket: `groupup-public` (görseller, özel domain `cdn.<domain>`), `groupup-private` (kanıt belgeleri, imzalı URL). API token (Object Read & Write).
- [ ] **DeepL API Free** anahtarı (kart doğrulaması ister, ücret çekmez).
- [ ] **AWS SES** — domain doğrulama (SPF, DKIM, DMARC kayıtları), sandbox'tan çıkış talebi, `eu-central-1`.
- [ ] **Alan adı** (ör. `groupup.app` / `.com.tr`) + DNS (Cloudflare).
- [x] **İstanbul Kent Üniversitesi mail domainleri** — öğrenci `ogr.kent.edu.tr`, mezun `mezun.kent.edu.tr` (teyit edildi).
- [x] **GitHub repo** — https://github.com/efecnbyrak/groupUp
- [ ] **KVKK metinleri** — taslak hazır (`/yasal/*`, `messages/*.json` `legal.*`, F12.3), ama **hukuki inceleme/onay bekliyor**; veri sorumlusu tüzel kişi unvanı + destek e-postası metinlerde `[...]` olarak işaretli, doldurulmadı.
- [ ] Sentry (opsiyonel, ücretsiz katman).
- [ ] **Redis: gerekmiyor.** Rate limit Postgres'te ([ADR-0008](adr/0008-rate-limit-postgres.md)). Ölçülmüş ihtiyaçta Upstash.

## 2. Canlı ortam değişkenleri
`.env.example` ile aynı anahtarlar; farklar:
| Değişken | Canlı değer |
|---|---|
| `APP_URL` | `https://<domain>` |
| `MAIL_PROVIDER` | `ses` (+ `AWS_*`) |
| `STORAGE_DRIVER` | `r2` (+ `R2_*`) |
| `TRANSLATION_PROVIDER` | `deepl` |
| `DATABASE_URL` | pooled bağlantı; `DIRECT_URL` migration için |

## 3. Yayın adımları
1. Vercel'e GitHub repo bağla, Framework: Next.js, Build: `npm run build:deploy` (`prisma generate && prisma migrate deploy && next build`).
2. Ortam değişkenlerini gir (Production + Preview ayrı DB).
3. Cron (`vercel.json`): dakikalık cron kullanılmaz (Hobby planda sıklık sınırlı). Öneri: `/api/cron/hourly` (seçim durum geçişleri, hatırlatmalar), `/api/cron/daily` (temizlik, çeviri tekrar deneme, etkinlik COMPLETED). Seçim geçişleri ayrıca sayfa açılışında "lazy" kontrol edilir (cron gecikmesine dayanıklı).
4. `npm run db:seed` (yalnızca ilk kurulumda, Süper Admin şifresi güçlü).
5. Duman testi: kayıt → mail → giriş → kulübe katıl → başvur.

## 4. Maliyet tahmini (Öneri, 1 üniversite, ~3.000 kullanıcı)
| Kalem | Aylık |
|---|---|
| Vercel Hobby / Pro | $0 / $20 |
| Neon Free | $0 (0.5 GB) |
| R2 | $0 (10 GB'a kadar) → sonra ~$0.015/GB |
| SES | ~$1 (10.000 mail) |
| DeepL Free | $0 (500K karakter) |
| **Toplam** | **~$1–21** |

## 5. Yedekleme ve izleme
- Neon: zaman noktasına geri dönüş (ücretsiz katmanda 24 saat) + haftalık `pg_dump` → R2 private (cron).
- Log: Vercel log'ları + Sentry. Uptime: ücretsiz bir ping servisi (Öneri: Better Stack / UptimeRobot).
