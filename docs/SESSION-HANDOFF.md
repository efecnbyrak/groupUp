# Oturum Devri

## Ne zaman?
- Bağlam (context) ~%70 dolduğunda, veya
- Bir faz bittiğinde (yeni fazı temiz bağlamla başlatmak daha verimli).

## Claude'un yapacakları (devirden önce)
1. Çalışan kodu kırık bırakma: yarım kalan adımı ya bitir ya geri al.
2. `docs/ROADMAP.md`: checkbox'ları güncelle, **§Son durum**'u doldur (aktif faz, son tamamlanan, sıradaki adım, açık sorular).
3. Varsa yeni kararları ilgili docs dosyasına / ADR'ye yaz.
4. Kullanıcıyı uyar ve aşağıdaki prompt'u **doldurulmuş halde** ver.
5. Commit öner (kullanıcı onaylarsa).

## Devam prompt'u (şablon)
```
groupUp projesine devam ediyoruz.
1) CLAUDE.md ve docs/ROADMAP.md dosyalarını oku.
2) Aktif faz: F<n> — <faz adı>.
3) Son tamamlanan: <madde>.
4) Sıradaki: <madde>.
5) Sadece şu dokümanları aç: <docs/... listesi>.
6) Dikkat: <açık sorun / yarım kalan iş / önemli not>.
Plan mode'da başla, planı onaylatınca uygula. Bağlam dolmaya yaklaşınca beni uyar ve yeni devam prompt'u ver.
```

## Örnek (F1 başlangıcı)
```
groupUp projesine devam ediyoruz.
1) CLAUDE.md ve docs/ROADMAP.md dosyalarını oku.
2) Aktif faz: F1 — İskelet.
3) Son tamamlanan: F0 (planlama dokümanları, ADR'ler, git init).
4) Sıradaki: F1.1 create-next-app.
5) Sadece şu dokümanları aç: docs/ARCHITECTURE.md, docs/SETUP-LOCAL.md, docs/DESIGN.md (§1–3).
6) Dikkat: proje kökünde CLAUDE.md, docs/, .gitignore, .env.example var — create-next-app bunları ezmemeli (geçici klasörde oluşturup taşı).
Plan mode'da başla, planı onaylatınca uygula. Bağlam dolmaya yaklaşınca beni uyar ve yeni devam prompt'u ver.
```
