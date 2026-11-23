# 0005. Dosya depolama: lokal disk → Cloudflare R2

- **Durum:** Kabul edildi
- **Tarih:** 2026-11-23
- **Karar vericiler:** Claude (kullanıcının "boyut büyüyebilir, en iyi yolu seç" talimatıyla)
- **İlgili:** [APPROVALS-TICKETS.md](../APPROVALS-TICKETS.md) §5

## Bağlam ve problem tanımı
Etkinlik kapakları/galerileri, kulüp logoları, avatarlar (public) ve kanıt belgeleri, mezun belgeleri, form dosya cevapları (private). Hacim zamanla büyür; görseller çok okunur (çıkış trafiği maliyeti belirleyici).

## Değerlendirilen alternatifler
- **Cloudflare R2:** S3 API uyumlu, **çıkış trafiği ücretsiz**, 10 GB ücretsiz, sonra ~$0.015/GB-ay.
- **Vercel Blob:** kolay entegrasyon, ama ücretsiz kota küçük ve trafik ücretli.
- **AWS S3:** olgun, ama çıkış trafiği ücretli.
- **Veritabanında saklama:** DB'yi şişirir, pahalı.

## Karar
`StorageProvider` arayüzü (`put`, `getPublicUrl`, `getSignedUrl`, `delete`). Driver'lar: `local` (geliştirme, `./storage`, Next route ile servis) ve `r2` (canlı, `@aws-sdk/client-s3`). İki bucket: public (görseller) + private (belgeler, 5 dk imzalı URL). Görseller yüklemede `sharp` ile WebP'ye çevrilir, 400w ve 1200w varyant üretilir, EXIF silinir; next/image optimizasyonu kullanılmaz (ek maliyet yok).

## Sonuçlar
**Olumlu:** Büyüyen hacimde en düşük maliyet; S3 uyumluluğu sayesinde sağlayıcı değiştirmek tek dosya.
**Olumsuz:** Lokal driver ile canlı driver arasında küçük davranış farkları → entegrasyon testi.

## Yeniden değerlendirme tetikleyicisi
Aylık depolama maliyeti $20'yi aşarsa veya video desteği gerekirse.
