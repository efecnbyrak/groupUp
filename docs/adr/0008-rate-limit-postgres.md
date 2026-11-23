# 0008. Rate limit Postgres'te, Redis yok

- **Durum:** Kabul edildi
- **Tarih:** 2026-11-23
- **Karar vericiler:** Claude
- **İlgili:** [AUTH-EMAIL.md](../AUTH-EMAIL.md)

## Bağlam ve problem tanımı
Giriş, OTP, şifre sıfırlama, kayıt ve davet kodu denemeleri sınırlandırılmalı. Redis kurulu değil; minimum altyapı isteniyor. Trafik orta.

## Değerlendirilen alternatifler
- **Postgres tablosu (sabit pencere, tek `INSERT ... ON CONFLICT DO UPDATE`):** ek altyapı yok, sunucusuz ortamda örnekler arası tutarlı.
- **Upstash Redis:** hızlı, ücretsiz katman var; ama ek servis/hesap.
- **Bellek içi:** sunucusuz/çok örnekli ortamda işe yaramaz.

## Karar
`RateLimit(key, count, windowEnd)` tablosu; tek atomik upsert sorgusu. Süresi dolan satırlar günlük cron ile silinir. Yalnızca hassas uç noktalarda kullanılır (her istekte değil).

## Sonuçlar
**Olumlu:** Sıfır ek maliyet ve altyapı.
**Olumsuz:** Her korumalı istekte bir DB yazması (düşük hacim, kabul edilebilir).

## Yeniden değerlendirme tetikleyicisi
Rate limit yazmaları DB CPU'sunun %20'sini aşarsa veya genel API rate limiti gerekirse → Upstash.
