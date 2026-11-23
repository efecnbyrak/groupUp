# Tasarım Sistemi ve Sayfalar

> Kaynak standart: `professional-design-system` skill'i (`~/.claude/skills/professional-design-system`). Bu dosya projeye özel kararları içerir; genel kurallar (token, erişilebilirlik, hareket) skill'den gelir. UI işinden önce skill'i yükle.

## 1. Arketip kararı
| Bölge | Arketip | `data-archetype` |
|---|---|---|
| Landing (giriş yapmamış `/`), auth sayfaları | **Editorial Product** | `editorial` |
| Feed, Keşfet, kulüp/etkinlik sayfaları | **Productive UI** (16px gövde — tüketici yoğunluğu) | `productive` |
| Tüm paneller | **Productive UI** (14px gövde, sidebar shell) | `productive` |
Tek token seti; Tailwind v4 `@theme` ile `assets/tokens.css` eşlenir (`references/tokens.md`). Ham hex/px yasak.

## 2. Tipografi, ikon, font
- Font: **Inter** (next/font, `latin` + `latin-ext` → Türkçe karakterler), 2 ağırlık dosyası (400, 600).
- İkonlar: `lucide-react` (tek set, 20px varsayılan, `aria-hidden` + metin etiketi).
- Görseller kullanıcı tarafından sonra verilecek; şimdilik **SVG illüstrasyon yer tutucuları + gradyansız düz renk alanları** ve demo verisi.

## 3. Renkler
### 3.1 Marka
- Marka ana renk: **mavi-indigo** (`--brand-600` ≈ `#3b5bdb` başlangıç önerisi; F3'te kontrast scripti ile kesinleştirilir). Landing ve öğrenci uygulamasının rengidir.
### 3.2 Panel vurgu renkleri (`data-panel` → `--color-brand-*` yeniden tanımlanır)
| `data-panel` | Rol | Ton (Tailwind paleti referans) | Kullanım |
|---|---|---|---|
| `student` | Öğrenci | blue 600/700 | uygulama header aktif durumu, birincil düğmeler |
| `alumni` | Mezun | amber 700/800 (koyu ton → kontrast) | aynı yerler + profil rozeti "Mezun" |
| `president` | Başkan | emerald 700 | kulüp paneli sidebar aktif öğe, başlık şeridi |
| `staff` | Görevli | teal 700 | aynı panel, farklı şerit |
| `admin` | Üniversite Admini | violet 700 | admin paneli |
| `platform` | Süper Admin | slate 800 | platform paneli |
- Her panelin üstünde 4px renkli şerit + sidebar'da rol etiketi ("Kulüp Paneli · Başkan") → kullanıcı hangi panelde olduğunu anında görür.
- Durum renkleri (başarı/uyarı/hata/bilgi) panelden bağımsız, sabit.
- **Kontrol:** `npm run check:contrast` (`scripts/contrast-check.mjs`, skill scriptinin panel destekli hali) — tüm paneller ≥ 4.5:1 (metin) / ≥ 3:1 (UI) geçmeden F3 bitmez.
- Karanlık mod: **kapsam dışı** (sonra eklenebilir; token yapısı hazır).

## 4. Header (giriş yapmış, `productive`, sticky 64px)
```
[groupUp logo] [Ana Sayfa] [Keşfet] [Kulüpler ▾] [Etkinliklerim]     [🔍 Ara]  [🔔 3] [TR|EN] [Avatar ▾]
```
- **Kulüpler ▾** (açılır panel): "Kulüplerim" listesi (logo, ad, rolüm: Üye/Görevli/Başkan) + her kulüpte Başkan adı + "Tüm kulüpleri keşfet" linki.
- **Etkinliklerim:** başvurularım / takımlarım / maçlarım.
- **Bildirim zili:** okunmamış sayısı, açılır son 10 bildirim, "Tümü".
- **Avatar ▾:** ad + rol rozetleri, Profil, Panel linkleri (rolüne göre: Kulüp Paneli [kulüp adı], Admin Paneli, Platform Paneli), Ayarlar, Çıkış.
- Admin'e onay bekleyen talep varsa Avatar menüsünde ve header'da sayaç rozeti.
- **Mobil (<1024):** üst bar (logo · arama ikonu · zil · avatar) + **alt tab bar** (Ana Sayfa · Keşfet · Kulüpler · Etkinliklerim · Profil), etiketler her zaman görünür.
- Giriş yapmamış header (editorial, 56px): logo · Nasıl çalışır · Özellikler · Kulüpler için · SSS · [Giriş yap] [Kayıt ol].

## 5. Landing sayfası (`/`, giriş yapmamış)
1. **Hero:** başlık "Kulübün tüm etkinlikleri tek yerde." + alt metin (form, takım, turnuva şeması, onay) + [Okul mailinle kayıt ol] [Nasıl çalışır] + sağda ürün mockup'ı (HTML/CSS ile çizilmiş örnek etkinlik kartı + mini braket — görsel gelene kadar).
2. **Güven bandı:** "İstanbul Kent Üniversitesi kulüpleri ile tasarlandı" + istatistik (demo: 24 kulüp · 180 etkinlik · 3.200 başvuru · 40 turnuva) — `seed-demo` sayıları, canlıda gerçek sayım.
3. **Nasıl çalışır (3 adım):** Okul mailinle kayıt ol → Kulübüne kodla katıl → Etkinliğe tek tıkla başvur.
4. **Özellikler (6 kart):** Akıllı başvuru formu · Takım kur, kodla davet et · Otomatik turnuva şeması · Excel'e tek tık · Admin onaylı güvenli yönetim · TR/EN otomatik çeviri.
5. **Kulüpler için:** Google Forms → E-Tablo → elle şema → başka site karşılaştırması ("Eskiden / groupUp ile") iki sütun.
6. **Roller:** Öğrenci · Mezun · Kulüp Başkanı · Üniversite Admini — her biri kendi panel rengiyle küçük kart.
7. **Turnuva vitrini:** canlı demo braket (SVG bileşeni, seed verisi).
8. **SSS** (akordeon, 6 soru: hangi mail, mezunum, kulübe nasıl katılırım, ücretli mi, verilerim, üniversitem yok).
9. **Son CTA bandı** + footer (directory: Ürün, Kulüpler için, Destek, Yasal [KVKK, Gizlilik, Kullanım Şartları], dil seçici).

## 6. Bileşen listesi (F3'te bir kez yapılır, tüm durumlarıyla)
Button (primary/secondary/ghost/danger, loading), IconButton, Input, Textarea, Select, Checkbox, Radio, Switch, OTP input (6 kutu, yapıştırma), PasswordInput (göster/gizle + canlı kural listesi), FileUpload (sürükle-bırak, ilerleme), Badge/Chip, Avatar, Card, **EventCard**, **ClubCard**, StatCard, Tabs, Breadcrumb, Pagination ("Daha fazla yükle"), Sidebar, BottomTabBar, Dropdown, Modal, Drawer, Toast, Tooltip, Alert, EmptyState, Skeleton, Table (sıralama, seçim), DiffView (onay ekranı), RichTextEditor (Tiptap), RichTextView, Countdown, CapacityBar, **Bracket (SVG)**, StandingsTable.

## 7. Etkinlik kartı (anatomi)
```
┌─────────────────────────────┐
│ [kapak 16:9]   [Turnuva]çip │
├─────────────────────────────┤
│ (logo) Spor Kulübü          │
│ Bahar Futbol Turnuvası      │  ← heading-md, 2 satır kırp
│ 📅 Cmt 12 Nis · 14:00–18:00 │
│ 📍 Kampüs Halı Saha         │
│ 👥 Takım (5–7) · ▓▓▓░ 12/16 │
│ ⏳ Son 2 gün 4 saat [Açık]  │  ← rozet rengi: açık=yeşil, son 48s=amber, doldu=gri
│ [Başvur]  veya  ✓ Kabul     │
└─────────────────────────────┘
```
Grid: masaüstü 3 sütun, tablet 2, mobil 1 (tam genişlik). Tüm kart tıklanabilir (tek link + iç düğme `stopPropagation` yerine ayrı hedef).

## 8. Panel düzeni
Sidebar shell (`templates/dashboard.md`): 240px sidebar (mobilde drawer), üstte rol şeridi, içerikte sayfa başlığı + birincil eylem, tablolar.
- **Kulüp paneli menüsü:** Genel bakış · Etkinlikler · Başvurular · Takımlar · Turnuvalar · Üyeler · Ekip (görevliler) · Davet kodları · Duyurular · Talepler (onay durumları) · Destek (ticket) · Kulüp bilgileri.
- **Admin paneli:** Genel bakış · Onay kuyruğu (sayaç) · Kulüpler · Kullanıcılar · Mezun doğrulama · Seçimler · Destek · Fakülte/Bölüm · Denetim kaydı.
- **Platform paneli:** Üniversiteler · Domainler · Adminler · Üniversite talepleri · Kategoriler · Destek · Sistem durumu.
Yetkisi olmayan menü öğeleri **gizlenir** (sunucu yine kontrol eder).

## 9. Performans bütçesi
- Landing: JS ≤ 100 KB (gzip), LCP < 2.0 s; hero görseli yok/hafif SVG.
- Görseller: yüklemede `sharp` → WebP 400w + 1200w; `<img srcset>` + `width/height` + `loading="lazy"` (ilk ekran hariç).
- Tiptap ve exceljs yalnızca ilgili sayfalarda dinamik import.
- Hareket: 150/220/320 ms, yalnız transform/opacity, `prefers-reduced-motion`.
