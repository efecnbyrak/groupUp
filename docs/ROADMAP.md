# Yol Haritası ve İlerleme

> Her oturum bu dosyayı okur ve günceller. Bir maddeyi bitirince `[x]` yap. Oturum biterken **§Son durum**'u doldur.

## Son durum
- **Aktif faz:** F5 — Kulüp, üyelik, ekip, onay motoru, ticket (başlanmadı)
- **Son tamamlanan:** F4 tamamı (`main`'e merge edildi): Platform paneli (üniversite/domain/Admin/talep/kategori), Admin paneli (genel bakış, kullanıcılar, fakülte/bölüm, bekleyen mezunlar), profil + avatar, aktif oturumlar, hesap silme, manuel mezun yolu (belge + bekleme ekranı). 127 vitest + 10 e2e.
- **Sıradaki adım:** F5.1 şema (ClubCategory/EventCategory zaten var) → Club, Membership, ClubInvite, StaffAssignment, Announcement, ChangeRequest, Attachment, Ticket, TicketMessage.
- **Açık sorular / engeller:** yok.
- **F4 notları:** Ortak action gövdesi `runAction(formData, { authorize, schema, errors, run })` (`src/i18n/action-result.ts`): sıra authz → zod → servis, `redirect()` `unstable_rethrow` ile geçer. `'use server'` dosyaları sabit export edemez → hata anahtarları modülde `errors.ts`. Formlar için `ActionForm` / `ActionDialog` / `ConfirmAction` (`src/components/ui/action-form.tsx`, alanlar `FormField[]` prop'u; gizli alanlar flex dışında). `Select` `group` ile `<optgroup>` (profilde fakülte → bölüm tek seçim; fakülte sunucuda bölümden türetilir). `Pagination` (cursor: ilk sayfa + sonraki), `StatCard`. Depolama `src/lib/storage` (`getStorage()`, `newFileKey`, `publicFileUrl`; lokal: `STORAGE_LOCAL_DIR/{public,private}`, public `/api/files/<key>`, private 5 dk HMAC imzalı `/api/files/private?key&exp&sig`; r2 F12). Dosya tipi magic byte ile (`src/lib/file-type.ts`), avatar sharp 256×256 WebP (`src/lib/images.ts`); `serverActions.bodySizeLimit: 11mb`. Ortak kişi alanları `src/lib/person-fields.ts` (kayıt + profil). Modüller arası transaction: `Tx` tipi (`src/lib/db.ts`); hesap silmede identity → `anonymizeProfileForDeletion` (profile) + `revokeAdminRolesForUser` (university). Admin paneli üniversitesi `requireAdminPage()` (`app/panel/admin/admin-context.ts`, istek başına cache); action'lar gizli `universityId` + `requireUniversityAdmin`. Manuel mezun: domain çözümlenmeyen mail + seçilen üniversite (MANUAL/BOTH) → ALUMNI; OTP sonrası `PENDING_ALUMNI_REVIEW` (`isManualAlumni`), `requirePageUser` → `/mezun-dogrulama`, action kapısı `requirePendingAlumni()`. Belge alanları şimdilik `AlumniVerification` üzerinde (F5: ChangeRequest ALUMNI_VERIFY + Attachment, Admin onay/ret, `alumni-result` maili). Hesap silme: şifre + onay → `DELETE_ACCOUNT` link (30 dk) → `/hesap/sil/onay` (proxy'de oturumsuz açık, GET silmez) → anonimleştirme (e-posta `deleted+<id>@deleted.invalid`); son Süper Admin silinemez; başkan kontrolü F5'te `requestAccountDeletion`'a eklenecek. Kategoriler F4'te öne çekildi (`club`, `event` modüllerinde yalnızca kategori servisi; silmede kullanım kontrolü F5/F6'da genişler). `notFound()` Suspense içinde streaming nedeniyle HTTP 200 + 404 arayüzü döner (e2e içerikten doğrular). cacheComponents önceki rotayı gizli `<Activity>` olarak DOM'da tutar → e2e seçicilerinde `.filter({ visible: true })`. e2e ortak yardımcılar `tests/e2e/helpers.ts` (`registerStudent`, `login`, `superAdmin`, `waitForMail`). Entegrasyon testleri depolamayı `os.tmpdir()/groupup-test-storage`'a yazar. Bildirim mailleri (Admin atandı, talep reddedildi) F10.
- **F3 notları:** i18n: `src/i18n/request.ts` (next-intl config), `server.ts` `getT()/getLocale()` imzası aynı (içi next-intl), `messages.ts` `createT` next-intl `createTranslator` ile (mail/action-result/test). Client'a katalog GÖNDERİLMEZ (NextIntlClientProvider yok) → metinler prop (`labelsFor`) ile; mesajlar ICU: `{ }` literal için `'{'` kaçışı (test tüm anahtarları biçimler). Sayfa başlıkları `titled(key)` (`app/_lib/metadata.ts`). `<html lang>` statik `tr` + `HtmlLangSync` (client effect). Bileşen yerleşimi: `src/components/ui` (→ ui, lib, i18n), `src/components/shell` (header/footer/panel kabukları, sunumsal; eylemler app'ten prop), `src/components/marketing` (landing) — eslint elemanları eklendi. Shell/marketing modül import edemez. Ortak sayfa kapısı `app/_lib/page-user.ts` (`requirePageUser`, `displayUser`). Yer tutucu rotalar `/akis` (giriş yapmış ana sayfa), `/kesfet`, `/kulupler`, `/etkinliklerim`, `/yasal/[slug]` (ComingSoon). Proxy: oturum cookie'si varsa `/` → `/akis`. Arketip: `data-archetype` + uygulama için `data-density="comfortable"` (16px gövde, 64px header). Yeni tokenlar: `--popover-width-*`, `--drawer-width`, `--bottom-bar-height`, `--panel-stripe-height`; panellerde `--color-link` panel rengini izler. Modal/Drawer native `<dialog>`; OtpInput tek gerçek input + 6 görsel kutu (yapıştırma/otofill/e2e `getByLabel`). Zorunlu alan yıldızı `<label>` dışında (erişilebilir ad temiz). Header'daki Kulüpler/Bildirim menüleri boş durum gösterir (F5/F10). Admin paneli linki avatar menüsüne F4'te eklenecek (şimdilik yalnızca Süper Admin → Platform). Bileşen testleri: saf yardımcılar vitest'te; DOM davranışı e2e (jsdom/testing-library onaysız). Kapsam dışı bırakılan DESIGN §6 bileşenleri ilgili fazlarda: EventCard/ClubCard, Bracket/Standings, DiffView, RichText, FileUpload, Countdown/CapacityBar, Pagination/Tooltip/StatCard/Breadcrumb.
- **F2 notları:** Servisler request bağlamına dokunmaz (cookie/oturum yalnızca `actions.ts`). Hata akışı: servis `ServiceError(code)` / `RateLimitError` → action `actionError(err, t, ERROR_KEYS)` (`src/i18n/action-result.ts`); zod mesajları = mesaj anahtarı. Client formlar metinleri prop olarak alır (`labelsFor(t, *_KEYS)`), `useFormAction` formu sıfırlamaz. `/dogrula` adresi imzalı `gu_verify` cookie'sinden. Modüller Prisma tiplerini `@/lib/db-types` üzerinden alır. eslint boundaries `moduleEntry` seçicisi `src/modules/*/index.ts` olarak düzeltildi (önceki hali hiç eşleşmiyordu). Migration `email_token_code_hash` (`EmailToken.codeHash` indeksi). Entegrasyon testleri `groupup_test`'te: önce `npm run db:test:migrate`. e2e dev DB + Mailpit kullanır; lokal istekler IP'siz olduğundan tüm IP rate limitleri tek anahtarı paylaşır (kayıt 10/saat) — e2e'yi saatte ~10'dan fazla çalıştırırsan `RateLimit` tablosunu temizle. Manuel mezun yolu (belge) F4, `requireClubPermission` F5'te. Mail HTML'inde ham hex zorunlu (mail istemcileri CSS değişkeni desteklemez). `AlumniVerification` F4. `npm audit`: prisma CLI'nin geçişli `effect` bağımlılığı (dev), upstream bekleniyor. Lokal Süper Admin: `admin@groupup.local`, şifre `.env` → `SUPERADMIN_PASSWORD`.
- **F1 notları:** Tailwind `@tailwindcss/postcss` (şablondaki `@tailwindcss/turbopack` onaysız). Prisma client `prisma/generated` (gitignore'da). Prisma `.env`'i `process.loadEnvFile` ile okur. tsx scriptleri `--conditions=react-server`. env şeması `src/lib/env-schema.ts`. npm 11 `allowScripts`.
- **Teyit edilenler (2026-11-23):** Kent domainleri `ogr.kent.edu.tr` / `mezun.kent.edu.tr`; tek kulüpte başkanlık; mezun oy vermez; 8 ADR `Kabul edildi`; repo https://github.com/efecnbyrak/groupUp (`main`).

---

## F0 — Planlama ve repo ✅
- [x] Gereksinim soruları ve kararlar
- [x] CLAUDE.md + docs/*.md + 8 ADR
- [x] `git init -b main`, `.gitignore`, `.env.example`
- [x] İlk commit
- [x] GitHub remote + push

## F1 — İskelet ✅
Okunacak: ARCHITECTURE.md, SETUP-LOCAL.md, DESIGN.md §1–3
- [x] F1.1 `npx create-next-app@latest` (TS, ESLint, Tailwind, App Router, `src/` YOK — `app/` kökte, `@/*` alias → `./src/*` ve `@/app/*`), mevcut dosyaları ezmeden
- [x] F1.2 Klasörler: `src/modules`, `src/lib`, `src/components/ui`, `src/i18n`, `messages/`
- [x] F1.3 `eslint-plugin-boundaries` kuralları + `server-only`
- [x] F1.4 Prisma 7 init (`prisma.config.ts`, adapter-pg), `src/lib/db.ts` singleton
- [x] F1.4b Lokal DB oluştur (SETUP-LOCAL §2) — kullanıcı çalıştırdı, `db:seed` bağlantı OK
- [x] F1.5 `src/lib/env.ts` (zod) + `.env` (kullanıcı oluşturur)
- [x] F1.6 `docker-compose.yml` (Mailpit) + `src/lib/mail/` (smtp/console provider) + test maili
- [x] F1.7 vitest + playwright kurulumu, örnek test
- [x] F1.8 package.json scriptleri (CLAUDE.md §3)
- [x] F1.9 Tasarım tokenları (`app/tokens.css`, Tailwind `@theme`), Inter, kontrast kontrolü
- [x] F1.10 lint + type-check + test yeşil → commit

## F2 — Kimlik ve üniversite ✅
Okunacak: AUTH-EMAIL.md, DATA-MODEL.md (§Kimlik), ROLES-PERMISSIONS.md §2
- [x] Şema v1: University, UniversityDomain, Faculty, Department, UniversityAdmin, UniversityRequest, User, Profile, Session, EmailToken, RateLimit, AuditLog → migration
- [x] Seed: Süper Admin, İstanbul Kent Üniversitesi + domainler + örnek fakülte/bölüm
- [x] `src/lib/session.ts`, `src/lib/authz.ts` (kulüp kapıları F5), `src/lib/rate-limit.ts`, `src/lib/audit.ts`
- [x] Şifre politikası (`identity/password-policy.ts`) + unit testler (zod'a bağlama kayıt şemasında)
- [x] Kayıt (domain çözümleme, üniversite talebi) → OTP → doğrulama
- [x] Giriş / çıkış / tüm cihazlardan çık
- [x] Şifremi unuttum / sıfırla
- [x] Şifre değiştir, mail değiştir
- [x] Mail şablonları (verify, reset, changed) TR/EN
- [x] `proxy.ts` yönlendirme
- [x] e2e: kayıt → Mailpit'ten kod → doğrula → giriş → çıkış → şifre sıfırla

## F3 — Tasarım sistemi, kabuklar, landing, i18n ✅
Okunacak: DESIGN.md (tamamı), skill: professional-design-system
- [x] next-intl (tr/en, cookie), `messages/*.json`, dil seçici
- [x] UI bileşenleri (DESIGN §6 — temel set: Button, Input, PasswordInput, OtpInput, Select, Card, Badge, Avatar, Dropdown, Modal, Drawer, Toast, EmptyState, Skeleton, Tabs, Table)
- [x] Panel renk temaları (`data-panel`) + kontrast scripti
- [x] Public header + footer, app header (dolu) + mobil alt tab bar, panel sidebar shell
- [x] Landing sayfası (DESIGN §5) demo verisiyle
- [x] Auth sayfalarını yeni tasarıma geçir
- [x] Responsive kontrol (1440/1024/768/390/360)

## F4 — Platform ve Admin paneli temeli, profil (1 oturum)
Okunacak: ROLES-PERMISSIONS.md, AUTH-EMAIL.md §6
- [x] Platform paneli: üniversite CRUD, domain CRUD, Admin atama, üniversite talepleri, kategoriler
- [x] Admin paneli iskeleti + genel bakış, kullanıcı listesi, fakülte/bölüm yönetimi
- [x] Profil sayfası + düzenleme + avatar yükleme (`src/lib/storage` lokal driver, sharp WebP)
- [x] Aktif oturumlar, hesap silme
- [x] Mezun doğrulama (manuel yol) — onay motoru F5'te; burada belge yükleme + bekleme ekranı

## F5 — Kulüp, üyelik, ekip, onay motoru, ticket (2 oturum)
Okunacak: APPROVALS-TICKETS.md, ROLES-PERMISSIONS.md, DATA-MODEL.md (§Kulüp)
- [ ] Şema: ClubCategory, Club, Membership, ClubInvite, StaffAssignment, Announcement, ChangeRequest, Attachment, Ticket, TicketMessage
- [ ] Admin: kulüp aç + Başkan ata
- [ ] Davet kodu / link → `/katil/[kod]` → direkt üyelik; kulüpten ayrıl
- [ ] Onay motoru (handler kayıt sistemi, unit test), Admin onay kuyruğu + DiffView
- [ ] Handler'lar: CLUB_UPDATE, MEMBER_REMOVE, MEMBER_BAN, STAFF_ASSIGN, STAFF_REMOVE, ALUMNI_VERIFY
- [ ] Kulüp paneli: genel bakış, üyeler, ekip (max 10), davet kodları, kulüp bilgileri (talep), talepler
- [ ] Kanıt yükleme (private storage, imzalı URL)
- [ ] Ticket (kulüp→admin, admin→platform)
- [ ] Kulüp sayfası (`/kulupler/[slug]`) + Keşfet'te kulüpler

## F6 — Etkinlik (2 oturum)
Okunacak: EVENTS-FORMS-I18N.md §1–3, §7–8
- [ ] Şema: EventCategory, Event, EventImage + seed kategoriler
- [ ] Tiptap editörü + sanitize'li görüntüleyici
- [ ] Etkinlik sihirbazı (adım 1–4, 6), otomatik taslak kaydı, görsel yükleme
- [ ] EVENT_PUBLISH / EVENT_UPDATE / EVENT_CANCEL handler'ları
- [ ] `src/lib/translation` (DeepL + none), hash ile tekrar çevirme engeli
- [ ] Feed (ana sayfa), Keşfet etkinlikler, etkinlik detay, EventCard
- [ ] Duyurular

## F7 — Başvuru formu ve takımlar (1–2 oturum)
Okunacak: EVENTS-FORMS-I18N.md §4–6
- [ ] Şema: EventFormField, Registration, Team, TeamMember
- [ ] Form oluşturucu (tüm alan tipleri, koşul, şablonlar)
- [ ] Başvuru (kontenjan kilidi, yedek liste, otomatik terfi), başvurularım
- [ ] Takım kur / kodla katıl / yönet
- [ ] Başvuru yönetim tablosu + xlsx/csv export

## F8 — Turnuva 1 (2 oturum)
Okunacak: TOURNAMENTS.md §1–4, §6–8
- [ ] Domain: tek eleme, round robin, grup+eleme, puan tablosu + eşitlik bozma (testler önce)
- [ ] Şema: Tournament, Stage, TournamentGroup, Participant, Match
- [ ] Katılımcı aktarımı, tohumlama ekranı
- [ ] Skor girişi + ilerleme + düzeltme
- [ ] SVG braket, grup tabloları, fikstür, maçlarım, public sayfa

## F9 — Turnuva 2 (2 oturum)
Okunacak: TOURNAMENTS.md §2.2, §2.5–2.6, §5
- [ ] Domain: çift eleme (+reset), İsviçre, FFA, iki maçlı
- [ ] Venue + TimeSlot + planlama algoritması + elle düzenleme
- [ ] xlsx + .ics çıktı, yazdırma görünümü

## F10 — Bildirimler ve zamanlanmış işler (1 oturum)
- [ ] Notification modeli + zil + bildirimler sayfası
- [ ] Tüm mail şablonlarını bağla (AUTH-EMAIL §9)
- [ ] `/api/cron/hourly`, `/api/cron/daily` (hatırlatmalar, temizlik, çeviri tekrar, COMPLETED)

## F11 — Seçim (1 oturum)
Okunacak: ELECTIONS.md
- [ ] Şema + durum makinesi (domain, test)
- [ ] Admin seçim yönetimi, adaylık, oy verme, sonuç + ELECTION_RESULT handler

## F12 — Sertleştirme ve canlıya hazırlık (1–2 oturum)
Okunacak: DEPLOYMENT.md, ARCHITECTURE.md §8
- [ ] e2e kritik akışlar, erişilebilirlik denetimi, Lighthouse
- [ ] Güvenlik başlıkları, CSP, rate limit gözden geçirme
- [ ] KVKK: metin sayfaları, veri dışa aktarma, anonimleştirme
- [ ] R2 + SES + DeepL canlı provider'ları, Vercel deploy

## F13 — Mobil (sonra)
- [ ] `app/api/v1` + bearer token oturumu, Expo uygulaması planı (ayrı plan oturumu)
