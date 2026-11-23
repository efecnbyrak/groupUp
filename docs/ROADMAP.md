# Yol Haritası ve İlerleme

> Her oturum bu dosyayı okur ve günceller. Bir maddeyi bitirince `[x]` yap. Oturum biterken **§Son durum**'u doldur.

## Son durum
- **Aktif faz:** F2 — Kimlik ve üniversite
- **Son tamamlanan:** F1 — İskelet (2026-11-23, `feat/f1-iskelet` → `main`)
- **Sıradaki adım:** F2 şema v1 (DATA-MODEL §Kimlik) → ilk migration
- **Açık sorular / engeller:** ⚠️ Lokal DB henüz oluşturulmadı — `groupup` rolü + `groupup`/`groupup_test` DB'leri sudo ister, kullanıcı çalıştıracak (SETUP-LOCAL §2). Doğrulama: `npm run db:seed` → "veritabanı bağlantısı tamam". F2 migration'ından önce şart.
- **F1 notları:** Tailwind `@tailwindcss/postcss` ile (Next 16.4 şablonundaki `@tailwindcss/turbopack` onaylı listede olmadığı için kullanılmadı). Prisma client `prisma/generated` (gitignore'da, `postinstall` üretir). Prisma `.env`'i `process.loadEnvFile` ile okur (dotenv yok). tsx scriptleri `--conditions=react-server` ile çalışır (`server-only` için). env şeması saf `src/lib/env-schema.ts`, çalışma zamanı `src/lib/env.ts`. npm 11 `allowScripts`: prisma, @prisma/engines, esbuild.
- **Teyit edilenler (2026-11-23):** Kent domainleri `ogr.kent.edu.tr` / `mezun.kent.edu.tr`; tek kulüpte başkanlık; mezun oy vermez; 8 ADR `Kabul edildi`; repo https://github.com/efecnbyrak/groupUp (`main`).

---

## F0 — Planlama ve repo ✅
- [x] Gereksinim soruları ve kararlar
- [x] CLAUDE.md + docs/*.md + 8 ADR
- [x] `git init -b main`, `.gitignore`, `.env.example`
- [x] İlk commit
- [x] GitHub remote + push

## F1 — İskelet ✅ (yalnız F1.4b DB kurulumu açık)
Okunacak: ARCHITECTURE.md, SETUP-LOCAL.md, DESIGN.md §1–3
- [x] F1.1 `npx create-next-app@latest` (TS, ESLint, Tailwind, App Router, `src/` YOK — `app/` kökte, `@/*` alias → `./src/*` ve `@/app/*`), mevcut dosyaları ezmeden
- [x] F1.2 Klasörler: `src/modules`, `src/lib`, `src/components/ui`, `src/i18n`, `messages/`
- [x] F1.3 `eslint-plugin-boundaries` kuralları + `server-only`
- [x] F1.4 Prisma 7 init (`prisma.config.ts`, adapter-pg), `src/lib/db.ts` singleton
- [ ] F1.4b Lokal DB oluştur (SETUP-LOCAL §2) — **kullanıcı, sudo gerekli**
- [x] F1.5 `src/lib/env.ts` (zod) + `.env` (kullanıcı oluşturur)
- [x] F1.6 `docker-compose.yml` (Mailpit) + `src/lib/mail/` (smtp/console provider) + test maili
- [x] F1.7 vitest + playwright kurulumu, örnek test
- [x] F1.8 package.json scriptleri (CLAUDE.md §3)
- [x] F1.9 Tasarım tokenları (`app/tokens.css`, Tailwind `@theme`), Inter, kontrast kontrolü
- [x] F1.10 lint + type-check + test yeşil → commit

## F2 — Kimlik ve üniversite (1–2 oturum)
Okunacak: AUTH-EMAIL.md, DATA-MODEL.md (§Kimlik), ROLES-PERMISSIONS.md §2
- [ ] Şema v1: University, UniversityDomain, Faculty, Department, UniversityAdmin, UniversityRequest, User, Profile, Session, EmailToken, RateLimit, AuditLog → migration
- [ ] Seed: Süper Admin, İstanbul Kent Üniversitesi + domainler + örnek fakülte/bölüm
- [ ] `src/lib/session.ts`, `src/lib/authz.ts`, `src/lib/rate-limit.ts`, `src/lib/audit.ts`
- [ ] Şifre politikası zod şeması + unit testler
- [ ] Kayıt (domain çözümleme, üniversite talebi) → OTP → doğrulama
- [ ] Giriş / çıkış / tüm cihazlardan çık
- [ ] Şifremi unuttum / sıfırla
- [ ] Şifre değiştir, mail değiştir
- [ ] Mail şablonları (verify, reset, changed) TR/EN
- [ ] `proxy.ts` yönlendirme
- [ ] e2e: kayıt → Mailpit'ten kod → doğrula → giriş → çıkış → şifre sıfırla

## F3 — Tasarım sistemi, kabuklar, landing, i18n (1 oturum)
Okunacak: DESIGN.md (tamamı), skill: professional-design-system
- [ ] next-intl (tr/en, cookie), `messages/*.json`, dil seçici
- [ ] UI bileşenleri (DESIGN §6 — temel set: Button, Input, PasswordInput, OtpInput, Select, Card, Badge, Avatar, Dropdown, Modal, Drawer, Toast, EmptyState, Skeleton, Tabs, Table)
- [ ] Panel renk temaları (`data-panel`) + kontrast scripti
- [ ] Public header + footer, app header (dolu) + mobil alt tab bar, panel sidebar shell
- [ ] Landing sayfası (DESIGN §5) demo verisiyle
- [ ] Auth sayfalarını yeni tasarıma geçir
- [ ] Responsive kontrol (1440/1024/768/390/360)

## F4 — Platform ve Admin paneli temeli, profil (1 oturum)
Okunacak: ROLES-PERMISSIONS.md, AUTH-EMAIL.md §6
- [ ] Platform paneli: üniversite CRUD, domain CRUD, Admin atama, üniversite talepleri, kategoriler
- [ ] Admin paneli iskeleti + genel bakış, kullanıcı listesi, fakülte/bölüm yönetimi
- [ ] Profil sayfası + düzenleme + avatar yükleme (`src/lib/storage` lokal driver, sharp WebP)
- [ ] Aktif oturumlar, hesap silme
- [ ] Mezun doğrulama (manuel yol) — onay motoru F5'te; burada belge yükleme + bekleme ekranı

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
