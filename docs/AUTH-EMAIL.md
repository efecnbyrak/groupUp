# Kimlik Doğrulama ve E-posta Akışları

## 1. Kayıt
1. Kullanıcı `/kayit`'ta mail girer.
2. Mail küçük harfe çevrilir; domain `UniversityDomain`'de aranır: önce tam eşleşme, sonra üst domainlere doğru (ör. `a.ogr.kent.edu.tr` → `ogr.kent.edu.tr`).
   - Bulunursa → `universityId` ve `type` (STUDENT/ALUMNI) belirlenir.
   - Bulunamazsa → "Üniversiteniz henüz groupUp'ta değil" + **Üniversite talebi formu** (`UniversityRequest`, Süper Admin'e düşer).
   - Mezun domaini olmayan üniversitede "Mezunum" seçeneği → manuel yol (§6).
3. Form: ad, soyad, öğrenci no (mailin yerel kısmı sayısalsa önerilir, değiştirilebilir), fakülte, bölüm (üniversitenin listesinden), sınıf **veya** mezuniyet yılı, telefon, cinsiyet, doğum tarihi, şifre + tekrar, KVKK aydınlatma metni onayı (zorunlu).
4. `User(status=PENDING_VERIFICATION)` + `Profile` oluşturulur → OTP maili gönderilir → `/dogrula`.
5. Aynı mail zaten varsa ve doğrulanmamışsa: kayıt güncellenir + yeni OTP. Doğrulanmışsa: genel hata ("Bu mail ile kayıt olunamıyor, giriş yapmayı deneyin").

## 2. OTP (mail doğrulama kodu)
| Kural | Değer |
|---|---|
| Format | 6 haneli rakam (`crypto.randomInt`) |
| Saklama | `sha256(code + email + SESSION_SECRET)` — düz kod saklanmaz |
| Geçerlilik | 10 dakika |
| Deneme | 5 yanlışta kod iptal, yeni kod istenmeli |
| Yeniden gönder | 60 sn bekleme, saatte en fazla 5, günde 10 (RateLimit) |
| Başarı | `emailVerifiedAt = now`, `status = ACTIVE` (manuel mezunda `PENDING_ALUMNI_REVIEW`), oturum açılır |
Yeni kod üretildiğinde aynı amaçlı eski kodlar `usedAt` ile geçersiz kılınır.

## 3. Giriş / çıkış
- Mail + şifre → argon2id doğrulama (kullanıcı yoksa da sahte hash doğrulaması yapılır → zamanlama sızıntısı olmaz).
- Doğrulanmamış hesap → yeni OTP + `/dogrula`'ya yönlendir.
- `SUSPENDED` → "Hesabınız askıya alındı" mesajı.
- Rate limit: IP başına 20/15 dk, mail başına 10/15 dk.
- "Beni hatırla" yok; oturum her zaman 30 gün kayan süreli.
- Çıkış: mevcut oturum silinir. "Tüm cihazlardan çık": kullanıcının tüm `Session` kayıtları silinir.

## 4. Oturum
- Token: 32 byte rastgele (base64url) → cookie `gu_session`; DB'de `sha256(token)`.
- Cookie: `httpOnly`, `secure` (canlıda), `sameSite=lax`, `path=/`, 30 gün.
- Her istekte `lastSeenAt` en fazla 1 saatte bir güncellenir (yazma yükü düşük); süre bitimine < 15 gün kaldıysa uzatılır.
- Profilde "Aktif oturumlar": cihaz (user-agent özeti), son görülme, tek tek kapatma.
- Süresi dolan oturumlar ve tokenlar günlük cron ile silinir.
- Next.js `proxy.ts` (middleware) yalnızca cookie varlığına bakıp yönlendirir; **asıl doğrulama** sunucu tarafında `requireUser()`'da.

## 5. Şifre politikası
| Kural | Değer |
|---|---|
| Uzunluk | 6–64 karakter |
| Zorunlu | ≥ 1 harf, ≥ 1 sembol |
| İzinli semboller | `! @ # $ % ^ & * ( ) - _ = + . , ? : [ ] { } ~` |
| **Yasak karakterler** | boşluk ve tüm whitespace, `<` `>` `"` `'` `` ` `` `/` `\` `;`, emoji ve kontrol karakterleri |
| Yasak içerik | Mailin yerel kısmını (öğrenci no) veya ad/soyadı içermesi |
| Harf seti | Türkçe harfler (ç ğ ı ö ş ü) **izinli** |
| Hash | argon2id (`@node-rs/argon2`, memoryCost 19456, timeCost 2) |
> Not: NIST SP 800-63B minimum 8 karakter önerir. Kullanıcı kararı 6'dır; ileride 8'e yükseltmek tek satırlık değişikliktir (zod şeması `src/modules/identity/schemas.ts`).

Arayüz: canlı kural listesi (✓/✗), göster/gizle düğmesi, yapıştırmaya izin ver.

## 6. Mezun doğrulama
**Domain yolu:** `mezun.*` domaini ile kayıt → `type=ALUMNI`, OTP sonrası ACTIVE.
**Manuel yol** (üniversitede mezun domaini yoksa veya `alumniVerifyMode` MANUAL/BOTH):
1. Kişisel mail ile kayıt + üniversite seçimi + OTP.
2. Belge yükleme (mezuniyet belgesi / e-Devlet mezun belgesi / diploma; PDF/JPG/PNG ≤ 10 MB, private).
3. `ChangeRequest(type=ALUMNI_VERIFY)` → Admin onay kuyruğu.
4. Onay → `status=ACTIVE`, ret → mail ile gerekçe, kullanıcı yeniden belge yükleyebilir.
**Öğrenci → mezun geçişi:** Profil → "Mezun oldum" → mezun domaini maili gir → OTP → `type=ALUMNI`, giriş maili yeni adres olur (eski üyelikler korunur). Mezun domaini yoksa belge yolu.

## 7. Şifremi unuttum / sıfırla
1. `/sifremi-unuttum`: mail gir → **her zaman** aynı yanıt ("Hesap varsa mail gönderdik").
2. Token: 32 byte, `sha256` saklanır, 30 dk, tek kullanımlık. Link: `/sifre-sifirla?token=...`
3. Yeni şifre (politika §5) → hash güncellenir → **tüm oturumlar silinir** → "Şifreniz değiştirildi" maili → giriş sayfası.
4. Rate limit: mail başına 3/saat, IP başına 10/saat.

## 8. Diğer hesap işlemleri
| İşlem | Akış |
|---|---|
| Şifre değiştir | Mevcut şifre + yeni şifre → diğer oturumlar kapanır → bildirim maili |
| Mail değiştir | Yeni mail (aynı üniversitenin domaini olmalı) → yeni adrese OTP → onayda değişir, eski adrese bilgi maili |
| Hesap sil | Şifre + onay → mail ile onay linki (`DELETE_ACCOUNT`, 30 dk) → kişisel veriler anonimleştirilir (`deletedAt`, ad="Silinmiş kullanıcı"), oturumlar silinir. Başkan ise önce devretmesi gerekir |
| Veri dışa aktar (KVKK) | Profil → JSON indir (F12) |

## 9. Mail listesi (şablonlar `src/modules/notification/emails/`)
| Şablon | Tetikleyici |
|---|---|
| `verify-email` | Kayıt, yeniden gönder, mail değişikliği |
| `password-reset` | Şifremi unuttum |
| `password-changed` | Sıfırlama / değiştirme sonrası |
| `email-changed` | Eski adrese bilgi |
| `delete-account` | Hesap silme onayı |
| `approval-result` | Talep onaylandı/reddedildi (Başkana) |
| `approval-pending` | Yeni talep (Admin'lere, günlük özet seçeneği) |
| `alumni-result` | Mezun doğrulama sonucu |
| `registration-update` | Başvuru kabul/ret/yedekten kabul |
| `team-update` | Takıma katılım, takım kabul edildi |
| `match-scheduled` | Maç saati atandı/değişti |
| `deadline-reminder` | Başvuru kapanışına 24 saat (başvurmamış üyelere, opt-out edilebilir) |
| `event-reminder` | Etkinliğe 24 saat (kabul edilenlere) |
| `ticket-reply` | Ticket yanıtı |
| `election` | Adaylık açıldı, oylama açıldı, sonuç |
| `club-role` | Başkan/görevli atandı |
Şablonlar: basit, tablosuz responsive HTML + düz metin alternatifi, TR/EN (kullanıcının `locale`'i). Gönderen: `groupUp <no-reply@...>`.

## 10. Mail altyapısı
```ts
interface MailProvider { send(msg: { to: string; subject: string; html: string; text: string }): Promise<void> }
```
- `MAIL_PROVIDER=smtp` → nodemailer → Mailpit (`localhost:1025`, arayüz `http://localhost:8025`).
- `MAIL_PROVIDER=ses` → `@aws-sdk/client-sesv2` (canlı).
- `MAIL_PROVIDER=console` → testlerde log'a yazar.
Gönderim hatası kullanıcı akışını bozmaz (OTP hariç: OTP gönderilemezse kullanıcıya hata gösterilir).

## 11. Güvenlik özeti
- Kullanıcı sayımı (enumeration) önlenir: giriş, şifremi unuttum ve kayıt hataları genel mesaj.
- CSRF: Server Actions Next'in origin kontrolüyle; route handler'larda `Origin` = `APP_URL` kontrolü.
- Tüm tokenlar hash'li; karşılaştırma `timingSafeEqual`.
- Güvenlik başlıkları (`next.config` headers): CSP, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.
