# 0003. Birincil veritabanı: PostgreSQL + Prisma 7

- **Durum:** Kabul edildi
- **Tarih:** 2026-11-23
- **Karar vericiler:** Proje sahibi
- **İlgili:** [DATA-MODEL.md](../DATA-MODEL.md)

## Bağlam ve problem tanımı
Veri yüksek derecede ilişkisel (üniversite → kulüp → üyelik → etkinlik → başvuru → takım → turnuva maçı), tutarlılık önemli (kontenjan, oy, onay). Kullanıcı PostgreSQL ve Prisma'yı zorunlu kıldı.

## Karar
Tek PostgreSQL veritabanı, tek şema. ORM: Prisma 7 + `@prisma/adapter-pg`. Değişken yapılı veri (form cevapları, onay payload'u, turnuva ayarları) JSONB + zod doğrulaması. Arama `pg_trgm`. Tenant izolasyonu uygulama katmanında `universityId` kapsamıyla (RLS yok — tek uygulama, tek DB kullanıcısı; gerekirse sonra).

## Gerekçe
Kullanıcı kararı; ilişkisel model + transaction + satır kilidi (kontenjan yarışı) + JSONB esnekliği tek motorda.

## Sonuçlar
**Olumlu:** Güçlü tutarlılık, tek veri kaynağı, ücretsiz yönetilen seçenekler (Neon).
**Olumsuz:** Uygulama katmanı tenant filtresini unutursa sızıntı → `authz` + kapsamlı sorgu yardımcıları + testler.

## Yeniden değerlendirme tetikleyicisi
Birden çok üniversite için sözleşmesel veri izolasyonu talebi (→ RLS veya üniversite başına şema).
