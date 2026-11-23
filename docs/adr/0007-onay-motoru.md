# 0007. Genel onay motoru (ChangeRequest + tip başına handler)

- **Durum:** Kabul edildi
- **Tarih:** 2026-11-23
- **Karar vericiler:** Claude
- **İlgili:** [APPROVALS-TICKETS.md](../APPROVALS-TICKETS.md)

## Bağlam ve problem tanımı
Kulüp bilgisi, etkinlik yayını/düzenlemesi/iptali, üye çıkarma/engelleme, görevli atama/çıkarma, mezun doğrulama ve seçim sonucu Admin onayından geçmeli. Liste büyüyebilir.

## Değerlendirilen alternatifler
- **A — Tek `ChangeRequest` tablosu + JSON payload + handler haritası:** tek kuyruk ekranı, yeni tip = yeni handler dosyası.
- **B — Her işlem için ayrı tablo ve ekran:** tip güvenliği DB'de, ama 8+ tablo, 8+ ekran, tekrar eden kod.
- **C — Genel iş akışı motoru (BPMN vb.):** aşırı karmaşık.

## Karar
A. Payload tip başına zod şemasıyla hem oluşturmada hem uygulamada doğrulanır. Handler `apply` transaction içinde ilgili modülün public servisini çağırır. Onay idempotenttir (`WHERE status='PENDING'`). Yayındaki etkinlik düzenlemesi onaylanana kadar eski hali yayında kalır.

## Sonuçlar
**Olumlu:** Admin için tek kuyruk; yeni onay tipi eklemek ucuz; tutarlı audit.
**Olumsuz:** JSON payload DB seviyesinde tipli değil → zod + unit test zorunlu.

## Yeniden değerlendirme tetikleyicisi
Çok aşamalı onay (ör. Admin + Dekanlık) gerekirse: `ChangeRequest`'e adım tablosu eklenir.
