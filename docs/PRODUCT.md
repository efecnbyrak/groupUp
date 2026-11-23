# Ürün Gereksinimleri — groupUp

## 1. Problem
Kulüp başkanları etkinlik başvurularını Google Forms ile topluyor, sonucu E-Tablo olarak indiriyor, grup oyunlarında takımları / bireysel oyunlarda şemayı elle kuruyor, turnuva şeması için başka bir siteye gidiyor. Süreç dağınık, hataya açık ve uzun.

## 2. Çözüm
Tek platform: doğrulanmış okul maili ile kayıt → kulübe kod/link ile katılım → zengin etkinlik sayfası + kapsamlı başvuru formu → takım kaydı → otomatik turnuva şeması/fikstür/puan tablosu → Excel çıktısı. Yönetimsel değişiklikler Üniversite Admini onayından geçer.

## 3. Roller
| Rol | Kim | Ne yapar |
|---|---|---|
| **Süper Admin** | Platform sahibi | Üniversite ekler, mail domainlerini tanımlar, Üniversite Admini atar, üniversite taleplerini ve Admin ticketlarını yanıtlar |
| **Üniversite Admini** | Her üniversiteden 1+ kişi | Kulüp açar, Başkan atar, onay kuyruğunu yönetir, ticket yanıtlar, seçim açar, mezun doğrular |
| **Kulüp Başkanı (Yönetici)** | Seçimle gelen öğrenci | Kulübü yönetir, 9 görevliye kadar ekip kurar, etkinlik/turnuva oluşturur, kritik işlemleri onaya gönderir, ticket açar |
| **Görevli** | Başkanın seçtiği max 9 kişi | Serbest unvan + işaretlenen yetkiler kadar iş yapar |
| **Öğrenci** | Öğrenci domaini ile kayıtlı | Kulübe katılır, etkinliğe başvurur, takım kurar/katılır, oy verir |
| **Mezun** | Mezun domaini veya manuel doğrulama | Öğrenci ile aynı (oy hakkı yok — varsayım) |

## 4. Alınmış kararlar (kullanıcı)
- Kayıt yalnızca sistemde tanımlı üniversite domainleriyle (ör. `ogr.kent.edu.tr`, `mezun.kent.edu.tr`). Domain türü kullanıcı türünü belirler.
- Mezun domaini olmayan üniversitede: kişisel mail + OTP + belge → Admin onayı.
- Kayıt mail OTP koduyla onaylanır. Kulübe giriş **onaysız**, kod veya link ile.
- Etkinliğe **yalnızca kulüp üyeleri** başvurabilir (ek filtre: sadece öğrenci / sadece mezun).
- Admin onayına giden işlemler: kulüp bilgisi değişikliği, etkinlik yayını ve düzenlemesi, üye çıkarma/engelleme (gerekçe + kanıt zorunlu), görevli atama/çıkarma.
- Yönetici takıldığında Admin'e ticket açar.
- Başkanlar seçimle gelir → online seçim modülü; sonuç Admin onayıyla uygulanır.
- Başvuru formu kapsamlı: üst kategori, görseller, zengin metin (H1/H2/bold/liste/link), özel alanlar. Tüm kulüp türleri düşünülür.
- İçerik Türkçe yazılır, İngilizceye otomatik çevrilir; arayüzde TR/EN dil seçici.
- Takım: kaptan kurar, davet koduyla üyeler katılır.
- Turnuva: tek eleme, çift eleme, lig, grup+eleme, İsviçre, FFA/sıralama, iki maçlı eleme + saha/saat planlama. Referans: LeagueLobster (saha/zaman aralığı, kısıtlar, puan tablosu, CSV/Excel çıktısı, takvim).
- Keşfet yalnızca kendi üniversitesini gösterir.
- Profil: ad, soyad, öğrenci no, fakülte, bölüm, sınıf/mezuniyet yılı, telefon, cinsiyet, doğum tarihi, profil fotoğrafı. TC Kimlik **alınmaz**.
- Şifre: en az 6 karakter + en az 1 sembol; yasaklı karakterler tanımlı.
- Her rol paneli farklı renkte.
- Ana sayfa topluluk akışı: katıldığı kulüplerin etkinlikleri kart halinde (konum, saat, deadline, başvuru durumu).
- Header dolu: kulüpler, yöneticiler, keşfet vb.
- Önce web, sonra mobil (Expo).

## 5. Onaylanmış kurallar ve varsayımlar
**Kullanıcı onayladı (2026-11-23):**
- Bir kullanıcı **tek kulüpte Başkan** olabilir; birden çok kulüpte üye/görevli olabilir.
- Mezunlar seçimde oy kullanamaz ve aday olamaz.
- İstanbul Kent Üniversitesi domainleri: `ogr.kent.edu.tr` (öğrenci), `mezun.kent.edu.tr` (mezun).
- Mezun yapısı: domain yolu + domaini olmayan okullar için belge + Admin onayı yolu.

**Varsayımlar (kullanıcı aksini söyleyene kadar geçerli):**
- Görevli aynı kulübün üyesi olmak zorundadır.
- Bir üniversitenin birden fazla Admini olabilir.
- Etkinlik kontenjanı dolunca yedek listeye alınır; iptal olursa sıradaki otomatik kabul edilir (etkinlik ayarı: otomatik/elle).
- Etkinlik saat dilimi `Europe/Istanbul`.

## 6. Temel kullanıcı hikâyeleri
**Öğrenci**
- Okul mailimle kayıt olup mailime gelen kodla hesabımı doğrulamak istiyorum.
- Arkadaşımın gönderdiği linke tıklayıp kulübe tek adımda katılmak istiyorum.
- Ana sayfada kulüplerimin etkinliklerini, deadline'ı yaklaşanları en üstte görmek istiyorum.
- Takım kurup arkadaşlarıma takım kodu göndermek istiyorum.
- Turnuva şemasında sıradaki maçımı ve saatini görmek istiyorum.

**Başkan**
- Etkinliği görseller ve zengin açıklamayla hazırlayıp onaya göndermek istiyorum.
- Başvuru formuna özel sorular eklemek istiyorum (beden, pozisyon, deneyim, dosya...).
- Başvuruları filtreleyip kabul/ret etmek ve Excel indirmek istiyorum.
- Kabul edilen takımlardan tek tıkla turnuva şeması oluşturmak istiyorum.
- Ekibime unvan ve yetki verip iş paylaştırmak istiyorum.
- Kural ihlali yapan üyeyi kanıtıyla birlikte Admin'e bildirip çıkarmak istiyorum.

**Üniversite Admini**
- Bekleyen talepleri tek kuyrukta, eski/yeni farkıyla görüp onaylamak/reddetmek istiyorum.
- Kulüp açıp Başkan atamak ve seçim başlatmak istiyorum.

**Süper Admin**
- Yeni üniversite ve domainlerini ekleyip Admin atamak istiyorum.

## 7. Kapsam dışı (şimdilik)
Ödeme/bilet ücreti, canlı sohbet, sürükle-bırak takvim, harici takvim senkronu (yalnızca .ics indir), push bildirim (mobil fazında).
