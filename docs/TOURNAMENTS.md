# Turnuva Motoru

> Referans: LeagueLobster Scheduler (tek/çift eleme, teselli maçları, iki maçlı eşleşmeler, grup + eleme, saha/zaman aralığı ataması, kısıtlar, puan tablosu, CSV/Excel çıktısı, takvim aboneliği). Biz bunu **kendi başvuru verimizle entegre** şekilde kuruyoruz: katılımcılar kabul edilmiş başvurulardan otomatik gelir.

## 1. Kavramlar
- **Tournament** bir etkinliğe bağlıdır; bir etkinlikte birden çok turnuva olabilir (ör. Kadın/Erkek kategorisi, A/B ligi).
- **Stage (aşama):** formatlar aşamalardan oluşur. `GROUPS_KNOCKOUT` = ROUND_ROBIN aşaması (gruplu) + KNOCKOUT aşaması.
- **Participant:** takım (`teamId`) veya birey (`userId`); `displayName` ve `seed`.
- **Match:** `round`, `position`, `nextMatchId/nextSlot` (kazanan ilerler), `loserMatchId/loserSlot` (çift eleme).
- Tüm üretim algoritmaları **saf fonksiyonlar** (`src/modules/tournament/domain/`): girdi = katılımcı listesi + ayarlar, çıktı = maç planı. DB'ye yazma servis katmanında. Hepsi vitest ile test edilir.

## 2. Formatlar
### 2.1 Tek eleme (Single Elimination)
- Braket boyutu `2^ceil(log2(n))`; eksikler **bye**. Bye'lar en üst tohumlara verilir.
- Tohumlama: standart braket sırası (1–16, 8–9, 5–12, …) — üst tohumlar finale kadar karşılaşmaz. Seçenek: elle tohum / rastgele (kura) / kayıt sırası.
- Seçenekler: 3.lük maçı, iki maçlı eşleşme (toplam skor; final tek veya iki maç), deplasman golü yok (eşitlikte penaltı skoru girilir).
- Bye maçları `status=BYE`, kazanan otomatik ilerler.

### 2.2 Çift eleme (Double Elimination)
- Üst braket (WINNERS) + alt braket (LOSERS) + büyük final (FINAL).
- Üst braketin r. turunda kaybedenler alt braketin uygun turuna düşer (çapraz yerleşim ile aynı rakiple erken rövanş azaltılır).
- Büyük final: üst braket şampiyonu vs alt braket şampiyonu; seçenek **"reset maçı"**: alt braketten gelen kazanırsa ikinci final oynanır.

### 2.3 Lig (Round Robin)
- **Circle (Berger) yöntemi:** n tek ise "BAY" eklenir; n-1 tur, her turda n/2 maç.
- Tek devre / çift devre (ikinci devre ev-deplasman ters).
- Ev/deplasman dengesi: Berger tablosu dönüşümlü atar.

### 2.4 Grup + Eleme
- Grup sayısı ve gruptan çıkacak kişi sayısı seçilir (ör. 4 grup × 4, ilk 2 çıkar).
- Gruplara dağıtım: **yılan (serpentine) tohumlama** — torbalar (pot) mantığı; veya kura.
- Grup içi round robin; grup bitince eleme braketi: A1–B2, B1–A2 çapraz eşleşme (aynı gruptan takımlar finale kadar karşılaşmaz, mümkün olduğunca).
- En iyi 3.ler gibi kurallar: ayar `bestThirds: k` (gruplar arası karşılaştırma tablosu).

### 2.5 İsviçre sistemi (Swiss)
- Tur sayısı ayarlanır (varsayılan `ceil(log2(n))`).
- Her tur: puan gruplarına göre sıralanır, eşit/yakın puanlılar eşleşir, **rövanş yasak**, tek sayıda katılımcıda en düşük puanlı ve daha önce bye almamış kişiye bye (1 puan).
- Eşleştirme: puan grubunda üst yarı vs alt yarı (Dutch sistemi basitleştirilmiş); çakışmada komşu takas (backtracking, n ≤ 128 için yeterli).
- Sonraki tur ancak önceki tur tamamlanınca üretilir.
- Eşitlik bozma: Buchholz → Sonneborn-Berger → ikili sonuç.

### 2.6 FFA / Sıralama (Free-for-all)
- Koşu, yüzme, e-spor battle royale, bilgi yarışması, fotoğraf yarışması gibi **2'den çok katılımcının aynı anda yarıştığı** etkinlikler.
- Her "heat/oturum" bir maçtır; sonuç `ffaResults: [{participantId, rank, points|time|score}]`.
- Puan tablosu: sıralamaya göre puan (ayarlanabilir dizi, ör. 10-8-6-5-4-3-2-1) veya en iyi süre/skor.
- Opsiyonel elemeli heat'ler: her heat'ten ilk k kişi sonraki tura.

### 2.7 Ortak ayarlar (`Tournament.settings`, zod şeması)
```ts
{
  points: { win: 3, draw: 1, loss: 0, forfeitWin: 3, forfeitLoss: 0 },
  allowDraws: boolean,
  tiebreakers: ('POINTS'|'HEAD_TO_HEAD'|'GOAL_DIFF'|'GOALS_FOR'|'WINS'|'BUCHHOLZ'|'SONNEBORN_BERGER'|'LOT')[],
  thirdPlaceMatch: boolean,
  twoLegged: boolean, twoLeggedFinal: boolean,
  doubleRoundRobin: boolean,
  grandFinalReset: boolean,
  swissRounds?: number,
  groups?: { count: number; advancePerGroup: number; bestThirds?: number },
  ffaPoints?: number[],
  scoreLabel: 'Gol' | 'Sayı' | 'Set' | 'Puan'   // spora göre etiket
  matchDurationMin: number, minRestMin: number, maxMatchesPerDay?: number
}
```
**Hazır profiller:** Futbol (3-1-0, averaj), Basketbol (beraberlik yok, 2-1 puan), Voleybol (set skoru), Satranç (1-½-0, İsviçre + Buchholz), E-spor (BO1/BO3), Bilgi yarışması (FFA).

## 3. Skor girişi ve ilerleme
- Yetki: Başkan + `TOURNAMENT_MANAGE`.
- Maç sonucu girilince: `winnerId` → `nextMatchId`'nin ilgili slotuna yerleştirilir (çift elemede kaybeden `loserMatchId`'ye). Transaction içinde.
- **Düzeltme:** sonraki maç henüz oynanmadıysa skor değiştirilebilir (ilerleme geri alınır ve yeniden yapılır); oynandıysa uyarı + zincirleme sıfırlama onayı. Her değişiklik AuditLog.
- Hükmen (walkover), ertelendi, iptal durumları.
- Seri maçlar (BO3/BO5, voleybol setleri): `homeScore/awayScore` = kazanılan oyun/set; detay opsiyonel (`MatchGame` tablosu gerekirse eklenir — YAGNI, başlangıçta yok).

## 4. Puan tablosu
- Hesaplanır, saklanmaz (n küçük, sorgu ucuz): O, G, B, M, A, Y, Av, P + form (son 5).
- Eşitlik bozma ayar sırasına göre; ikili averaj çoklu eşitlikte mini lig olarak hesaplanır.
- Grup + eleme: grup sonuçları kesinleşince "Eleme aşamasını oluştur" düğmesi (otomatik değil — yönetici kontrol eder).

## 5. Planlama (saha / zaman)
- Yönetici **sahalar** (Venue: "Saha 1", "Salon B", "Masa 3") ve **zaman aralıkları** (gün + başlangıç-bitiş, maç süresi) tanımlar.
- Algoritma (açgözlü, deterministik):
  1. Maçları tur sırasına göre sırala (bağımlı maçlar önceki turlardan sonra).
  2. Her maç için en erken uygun (saha, slot): katılımcılar o slotta başka maçta değil, `minRestMin` sağlanıyor, günlük `maxMatchesPerDay` aşılmıyor, katılımcının müsait olmadığı saatlere denk gelmiyor, bağımlı olduğu maçların bitişinden sonra.
  3. Yerleşemeyen maçlar "planlanamadı" listesinde gösterilir (yeni slot ekle önerisi).
- Elle düzenleme: maç → saha/saat değiştir (çakışma uyarısı). Değişiklikte katılımcılara bildirim.
- Gelecekte: sürükle-bırak takvim (kapsam dışı).

## 6. Görünümler
- **Braket:** SVG ile, kütüphanesiz. Tur sütunları, maç kutuları, bağlantı çizgileri; mobilde yatay kaydırma + tur sekmeleri. Çift elemede üst/alt braket iki bölüm.
- **Grup tabloları**, **fikstür listesi** (tarih/saha gruplu), **"Maçlarım"** (katılımcı için), **canlı skor yok** (sayfa yenileme; ileride SSE).
- **Paylaşım:** `isPublic` ise `/turnuva/[id]` giriş gerektirmez (salt okuma); QR kod opsiyonel.
- **Çıktı:** fikstür + puan tablosu xlsx, `.ics` (katılımcının maçları), yazdırma görünümü (A4).

## 7. Katılımcı aktarımı
"Turnuva oluştur" → kaynak seç: kabul edilmiş takımlar / kabul edilmiş bireyler / elle liste (CSV yapıştır — dış katılımcılar için). Sonradan katılımcı ekleme yalnızca `DRAFT`/`SEEDED` durumunda; başladıktan sonra yalnızca isim değişikliği.

## 8. Test senaryoları (vitest, zorunlu)
- Tek eleme: n = 2, 3, 5, 8, 13, 16, 33 → maç sayısı `n-1` (+3.lük), bye sayısı doğru, 1. ve 2. tohum yalnızca finalde karşılaşabilir.
- Çift eleme: n = 4, 6, 8, 16 → maç sayısı `2n-2` (reset hariç) / `2n-1` (reset dahil).
- Round robin: n = 4..10 → her çift tam bir kez (çift devrede iki kez, ev/dep ters), her turda kimse iki kez oynamaz.
- İsviçre: rövanş yok, bye bir kişiye en fazla bir kez.
- Puan tablosu: ikili averaj üçlü eşitlik senaryosu.
- Planlama: çakışma yok, dinlenme süresi sağlanıyor.
