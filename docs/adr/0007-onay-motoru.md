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

### Ek not (2026-11-23, F5) — bağımlılık yönü
Handler'lar `club`/`profile` servislerini çağırdığı için bu modüller `approval`'ı import ederse döngü oluşur. Bu yüzden yön **`approval → club, profile`**: talep oluşturan action'lar (görevli ata, üye çıkar, kulüp bilgisi, mezun belgesi) `approval` modülündedir; `club` ve `profile` yalnızca handler'ların çağırdığı `tx` alan uygulama fonksiyonlarını açar. Aynı hedef + tip için tek PENDING kuralı DB'de kısmi unique index ile de korunur.

## Sonuçlar
**Olumlu:** Admin için tek kuyruk; yeni onay tipi eklemek ucuz; tutarlı audit.
**Olumsuz:** JSON payload DB seviyesinde tipli değil → zod + unit test zorunlu.

## Yeniden değerlendirme tetikleyicisi
Çok aşamalı onay (ör. Admin + Dekanlık) gerekirse: `ChangeRequest`'e adım tablosu eklenir.
