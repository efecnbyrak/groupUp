# 0006. Otomatik çeviri: DeepL, onay anında bir kez

- **Durum:** Kabul edildi
- **Tarih:** 2026-11-23
- **Karar vericiler:** Claude (kullanıcının "en verimli yöntem" talimatıyla)
- **İlgili:** [EVENTS-FORMS-I18N.md](../EVENTS-FORMS-I18N.md) §7

## Bağlam ve problem tanımı
İçerik Türkçe yazılır, İngilizce gösterilebilmeli (değişim öğrencileri). Zengin metin (başlıklar, kalın, listeler) korunmalı. Maliyet minimum olmalı.

## Değerlendirilen alternatifler
- **DeepL API Free:** 500K karakter/ay ücretsiz, TR↔EN kalitesi yüksek, HTML etiketlerini korur.
- **Google Cloud Translation:** 500K ücretsiz, kalite iyi; GCP hesabı ve faturalandırma kurulumu.
- **Claude Haiku:** bağlamı iyi anlar, çok ucuz ama ücretsiz katman yok.
- **Görüntülemede anlık çeviri:** her görüntülemede maliyet + gecikme → reddedildi.

## Karar
`TranslationProvider` arayüzü; varsayılan DeepL. Çeviri yalnızca Admin onayı anında (taslaklar çevrilmez), kaynak alanların SHA-256 hash'i değişmediyse tekrar çağrılmaz, sonuç DB'de saklanır. Hata/kota durumunda TR gösterilir, günlük cron tekrar dener. Başkan EN metni elle düzeltebilir.

## Sonuçlar
**Olumlu:** Pratikte $0; görüntülemede gecikme yok.
**Olumsuz:** Onay işlemi DeepL çağrısı kadar uzar (~1 sn) → kabul edilebilir.

## Yeniden değerlendirme tetikleyicisi
Aylık 500K karakter aşılırsa (DeepL Pro veya Haiku provider'ı).
