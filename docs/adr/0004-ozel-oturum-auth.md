# 0004. Kimlik doğrulama: özel oturum (Auth.js yerine)

- **Durum:** Kabul edildi
- **Tarih:** 2026-11-23
- **Karar vericiler:** Claude (kullanıcının "en verimli yol" yetkisiyle)
- **İlgili:** [AUTH-EMAIL.md](../AUTH-EMAIL.md)

## Bağlam ve problem tanımı
Gereksinimler: yalnızca kayıtlı üniversite domainleri, mail OTP ile doğrulama, şifremi unuttum, mail değiştir, oturum/cihaz listesi, ilişkiden türeyen roller. Sosyal giriş (Google vb.) yok. Mobil (Expo) sonra aynı oturum modelini kullanmalı.

## Değerlendirilen alternatifler
### A — Özel oturum: opak token + DB Session
- Artılar: tüm akış kontrolümüzde, OTP/domain kuralları doğal, oturum iptali anında, mobilde aynı token bearer olarak kullanılabilir, ek bağımlılık yok.
- Eksiler: güvenlik detaylarını biz yazarız (iyi bilinen desen, dokümante).
### B — Auth.js v5 (credentials provider)
- Artılar: hazır CSRF, cookie yönetimi.
- Eksiler: credentials + DB session resmi olarak zayıf desteklenir, OTP/kayıt/şifre sıfırlama zaten bizde; beta sürüm.
### C — Harici sağlayıcı (Clerk, Supabase Auth)
- Eksiler: maliyet, vendor lock-in, domain/rol kuralları için yine özel kod.

## Karar
A: 32 byte rastgele token httpOnly cookie'de, DB'de SHA-256 hash; 30 gün kayan süre. Şifreler argon2id (`@node-rs/argon2`, prebuilt binary). OTP ve link tokenları hash'li, süreli, deneme sınırlı.

## Sonuçlar
**Olumlu:** Basit, anlaşılır, ücretsiz, mobil uyumlu.
**Olumsuz:** Güvenlik kodu bizim sorumluluğumuzda → unit + e2e testler, AUTH-EMAIL §11 kontrol listesi.

## Yeniden değerlendirme tetikleyicisi
SSO (üniversite Microsoft/Google hesabı) veya 2FA gereksinimi.
