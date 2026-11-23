# 0002. Makro mimari: tek Next.js uygulaması olarak modüler monolit

- **Durum:** Kabul edildi
- **Tarih:** 2026-11-23
- **Karar vericiler:** Proje sahibi, Claude
- **İlgili:** [ARCHITECTURE.md](../ARCHITECTURE.md), [0003](0003-postgresql-prisma.md)

## Bağlam ve problem tanımı
Tek geliştirici, tek web istemcisi (mobil sonra), orta trafik (varsayım: tepe ~50 RPS), minimum bütçe. Birden çok belirgin iş alanı var (kimlik, kulüp, onay, etkinlik, başvuru, turnuva, seçim). Kullanıcı Next.js 16 + Prisma 7 yığınını önceki projesinden biliyor.

## Karar kriterleri
1. Maliyet / kaynak verimliliği
2. Geliştirme hızı
3. Güvenlik (yetki + tenant izolasyonu)

## Değerlendirilen alternatifler
### A — Next.js içinde modüler monolit
- Artılar: tek deploy, tek dil, Server Components ile minimum client JS, kullanıcı biliyor, Vercel'e doğal uyum.
- Eksiler: sınırlar disiplin ister; mobil API ayrıca açılmalı.
### B — Next.js (UI) + ayrı NestJS/Fastify API
- Artılar: mobil için hazır API, net katman ayrımı.
- Eksiler: iki deploy, iki bağımlılık seti, tip paylaşımı için monorepo; tek web istemcisi için gereksiz maliyet.
### C — Mikroservisler
- Eksiler: hiçbir tetikleyici yok (bağımsız takım, farklı ölçek profili, uyumluluk izolasyonu yok); operasyon yükü çok yüksek.

## Karar
Tüm uygulamayı tek bir Next.js 16 (App Router) projesi olarak kuracağız. İş mantığı `src/modules/<modül>/` altında, modüller birbirine yalnızca `index.ts` public API'si ile erişir; `app/` yalnızca routing ve sayfa kabuğudur. Karmaşık kurallı modüllerde (tournament, approval, election) saf TS `domain/` klasörü kullanılır.

## Gerekçe
Üç kriterin tamamında A en iyisi. Mobil ihtiyaç, aynı servis fonksiyonlarını `app/api/v1` route handler'larıyla açarak karşılanır; B'ye geçiş gerekirse modül sınırları sayesinde ucuzdur.

## Sonuçlar
**Olumlu:** Düşük maliyet, hızlı geliştirme, tek tip sistemi.
**Olumsuz:** Sınır aşınması riski; tek hata alanı.
**Riskler ve azaltma:**
| Risk | Olasılık | Etki | Azaltma |
|---|---|---|---|
| Modüller birbirinin içine girer | Orta | Bakım zorlaşır | eslint-plugin-boundaries CI'da hata |
| İş mantığı `app/` içine kayar | Orta | Test edilemez kod | CLAUDE.md kuralı + review |

## Uygulama notları
F1'de klasör yapısı ve boundaries kuralları kurulur (CLAUDE.md §4).

## Yeniden değerlendirme tetikleyicisi
3+ geliştirici/bağımsız ekip; bir modülün yükü diğerlerinden büyüklük mertebesi farklı (ölçülmüş); mobil API'nin web'den bağımsız yayın ritmi gerektirmesi.
