# 0001. Mimari kararları ADR ile kaydetmek

- **Durum:** Kabul edildi
- **Tarih:** 2026-11-23
- **Karar vericiler:** Proje sahibi, Claude
- **İlgili:** [ARCHITECTURE.md](../ARCHITECTURE.md)

## Bağlam ve problem tanımı
Proje çok oturumlu (Claude oturumları arasında bağlam kaybolur) ve tek kişi tarafından uzun süre bakılacak. Kararların "neden"i kaybolursa sonraki oturumlar aynı tartışmayı tekrarlar veya kararı farkında olmadan bozar.

## Karar
Yapıyı, kalite niteliklerini, bağımlılıkları veya geri dönüşü pahalı seçimleri etkileyen kararları `docs/adr/NNNN-kisa-baslik.md` olarak kaydedeceğiz. Numara asla tekrar kullanılmaz; değişen karar yeni ADR ile "Yerini aldı" olarak işaretlenir. Kütüphane sürümü, isimlendirme, lint kuralı için ADR yazılmaz.

## Sonuçlar
**Olumlu:** Yeni oturum kararları hızla okur; tartışma tekrarlanmaz.
**Olumsuz:** Küçük bir yazım maliyeti.

## Yeniden değerlendirme tetikleyicisi
ADR'ler güncel tutulmuyorsa (kod ile çelişiyorsa) süreç sadeleştirilir.
