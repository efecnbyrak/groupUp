# groupUp — Proje Rehberi (Claude için ana giriş noktası)

> Her oturumun başında **önce bu dosyayı**, sonra [docs/ROADMAP.md](docs/ROADMAP.md)'yi oku. Yalnızca aktif fazın ihtiyaç duyduğu dokümanları aç. Bağlamı boşa harcama.

## 1. Proje nedir?
Üniversite kulüplerinin etkinlik, başvuru, takım, turnuva ve yönetim süreçlerini tek platformda toplayan web uygulaması. Google Forms → E-Tablo → elle sıralama → harici turnuva sitesi zincirini ortadan kaldırır.

Hiyerarşi: **Süper Admin (platform)** → **Üniversite Admini** → **Kulüp Başkanı (Yönetici)** → **Görevliler** (Başkan dahil max 10) → **Öğrenci / Mezun**.

Ayrıntı: [docs/PRODUCT.md](docs/PRODUCT.md)

## 2. Teknoloji yığını
| Katman | Seçim |
|---|---|
| Uygulama | Next.js 16 (App Router, Server Components, Server Actions), React 19, TypeScript strict |
| Veritabanı | PostgreSQL (lokal 19 kurulu) + Prisma 7 (`@prisma/adapter-pg`) |
| Stil | Tailwind CSS v4 (`@theme` token'ları), `lucide-react` ikonlar, Inter (next/font) |
| Doğrulama | zod 4 (her sınırda: form, action, route handler, env) |
| Auth | Özel oturum (opak token cookie + DB `Session`), şifre `@node-rs/argon2` |
| Mail | `MailProvider` → dev: Mailpit (docker, SMTP 1025 / UI 8025), canlı: AWS SES |
| Dosya | `StorageProvider` → dev: lokal `./storage`, canlı: Cloudflare R2; görseller `sharp` ile WebP |
| Çeviri | `TranslationProvider` → DeepL API Free (TR→EN, onayda bir kez, DB'de saklanır) |
| Zengin metin | Tiptap (JSON saklanır, sunucuda HTML + `sanitize-html`) |
| i18n | next-intl (tr varsayılan, en) — cookie tabanlı, URL prefix yok |
| Excel | exceljs (xlsx) + CSV |
| Test | vitest (unit/servis) + playwright (e2e) |
| Redis / kuyruk | **Yok.** Rate limit Postgres'te. Zamanlanmış işler cron route ile |

Mimari: **modüler monolit** — [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), kararlar [docs/adr/](docs/adr/).

## 3. Komutlar
```bash
npm run dev            # next dev --turbopack
npm run build          # prisma generate && next build
npm run lint           # eslint (boundaries kuralları dahil)
npm run type-check     # next typegen && tsc --noEmit
npm test               # vitest run
npm run test:e2e       # playwright test
npm run db:migrate     # prisma migrate dev
npm run db:seed        # tsx prisma/seed.ts
npm run db:studio      # prisma studio
npm run mail:test      # Mailpit'e test maili
npm run check:contrast # tokens.css + tüm data-panel temaları WCAG AA
docker compose up -d   # Mailpit
```
Kurulum: [docs/SETUP-LOCAL.md](docs/SETUP-LOCAL.md)

## 4. Klasör yapısı ve sınır kuralları
```
app/                     SADECE routing, layout, sayfa kabuğu. İş mantığı YOK.
  (public)/ (auth)/ (app)/ panel/platform/ panel/admin/ panel/kulup/[slug]/ api/v1/ api/cron/
src/
  modules/<modul>/
    index.ts             modülün PUBLIC API'si — diğer modüller yalnızca bunu import eder
    schemas.ts           zod şemaları
    service.ts           iş kuralları (Prisma burada)
    actions.ts           'use server' — ince: authz → zod → service
    queries.ts           server-only okuma fonksiyonları
    components/          modüle özel UI
    domain/              (sadece tournament, approval, election) saf TS, framework bağımsız
  lib/                   db, session, authz, mail, storage, translation, rate-limit, audit, sanitize, env
  components/ui/         paylaşılan UI bileşenleri (Button, Input, Card, Modal...) → ui, lib, i18n
  components/shell/      header/footer/tab bar/PanelShell (sunumsal; modül import etmez)
  components/marketing/  landing bölümleri
  i18n/                  next-intl config
messages/tr.json en.json
prisma/schema.prisma seed.ts
```
**Kurallar (eslint-plugin-boundaries ile zorlanır):**
1. Modül A, modül B'nin iç dosyasını import edemez → yalnızca `@/modules/b` (index.ts).
2. `app/` → `modules/*/index.ts`, `components/ui`, `lib` import edebilir. `modules` → `app` import edemez.
3. `domain/` klasörü Prisma, Next, React import edemez (saf TS, unit test edilir).
4. Sunucu kodu `import 'server-only'` ile işaretlenir.
5. Modüller birbirinin tablosuna doğrudan yazmaz; diğer modülün servis fonksiyonunu çağırır. (Okuma için Prisma `include` serbesttir.)

## 5. Yetki ve güvenlik kuralları (ASLA atlanmaz)
- Her server action ve route handler **ilk satırda** `src/lib/authz.ts` fonksiyonlarından birini çağırır: `requireUser()`, `requireSuperAdmin()`, `requireUniversityAdmin(universityId)`, `requireClubPermission(clubId, permission)`.
- Her sorgu `universityId` ile kapsamlanır (tenant izolasyonu). Kullanıcı başka üniversitenin verisini göremez.
- Admin onayı gerektiren işlemler (kulüp bilgisi, etkinlik yayın/düzenleme, üye çıkarma/engelleme, görevli atama/çıkarma) **doğrudan uygulanmaz** → `approval` modülüne `ChangeRequest` oluşturulur. Bkz. [docs/APPROVALS-TICKETS.md](docs/APPROVALS-TICKETS.md).
- Kritik işlemler `AuditLog`'a yazılır.
- Kullanıcı HTML'i yalnızca `sanitize-html` sonrası render edilir. `dangerouslySetInnerHTML` sadece sanitize edilmiş alanla.
- Gizli bilgiler yalnızca `.env`'de; `src/lib/env.ts` zod ile doğrular. `.env` asla commitlenmez.
- Roller/yetki matrisi: [docs/ROLES-PERMISSIONS.md](docs/ROLES-PERMISSIONS.md)

## 6. Kodlama kuralları
- TypeScript strict, `any` yok. Dosya adları kebab-case, bileşenler PascalCase.
- Varsayılan Server Component; `'use client'` yalnızca etkileşim gereken yaprak bileşenlerde.
- Listeler cursor pagination, her FK ve filtre alanında indeks.
- Para/sayı/tarih: tarihler DB'de UTC, gösterimde `Europe/Istanbul`.
- Kullanıcıya görünen tüm metinler `messages/*.json` üzerinden (sabit Türkçe string yok).
- Tasarım: `professional-design-system` skill'i + [docs/DESIGN.md](docs/DESIGN.md). Ham hex/px yok, token kullan.
- Yeni npm paketi, font, ikon seti veya ücretli servis → **kullanıcı onayı olmadan eklenmez** (onaylı liste: [docs/ARCHITECTURE.md §Bağımlılıklar](docs/ARCHITECTURE.md)).
- Mimari değişiklik → önce `software-architecture` skill'i, sonra ADR.
- Commit/push yalnızca kullanıcı isteyince. Commit mesajları: `feat(modul): ...`, `fix(...)`, `docs: ...`.

## 7. Oturum protokolü (ÇOK ÖNEMLİ)
1. Başlangıç: `CLAUDE.md` → `docs/ROADMAP.md` → aktif fazın dokümanları.
2. Faz içinde küçük, test edilebilir adımlarla ilerle; her adım sonunda ROADMAP checkbox'ını işaretle.
3. Bağlam ~%70 dolduğunda **kullanıcıyı uyar**, ROADMAP'teki "Son durum" bölümünü güncelle ve [docs/SESSION-HANDOFF.md](docs/SESSION-HANDOFF.md) şablonuyla **hazır devam prompt'u** ver.
4. Faz bitişi: `npm run lint && npm run type-check && npm test` yeşil → kullanıcıya commit öner.

## 8. Doküman dizini
| Dosya | İçerik |
|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | Ürün gereksinimleri, roller, kullanıcı hikâyeleri, kararlar |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Mimari plan, modüller, veri akışı, bağımlılıklar |
| [docs/DATA-MODEL.md](docs/DATA-MODEL.md) | Taslak Prisma şeması, enum'lar, indeksler |
| [docs/ROLES-PERMISSIONS.md](docs/ROLES-PERMISSIONS.md) | Rol/yetki matrisi, görevli yetkileri, panel renkleri |
| [docs/AUTH-EMAIL.md](docs/AUTH-EMAIL.md) | Kayıt, OTP, şifre politikası, oturum, tüm mail akışları |
| [docs/APPROVALS-TICKETS.md](docs/APPROVALS-TICKETS.md) | Onay motoru + ticket sistemi |
| [docs/EVENTS-FORMS-I18N.md](docs/EVENTS-FORMS-I18N.md) | Etkinlik, form oluşturucu, takım, çeviri, i18n |
| [docs/TOURNAMENTS.md](docs/TOURNAMENTS.md) | Turnuva formatları, algoritmalar, planlama |
| [docs/ELECTIONS.md](docs/ELECTIONS.md) | Online başkanlık seçimi |
| [docs/DESIGN.md](docs/DESIGN.md) | Tasarım sistemi, sayfalar, header, kartlar, panel renkleri |
| [docs/SETUP-LOCAL.md](docs/SETUP-LOCAL.md) | Lokal kurulum (Postgres, Mailpit, env, git) |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Canlıya çıkış + henüz kurulmamış altyapı listesi |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Fazlar, ilerleme checkbox'ları, son durum |
| [docs/SESSION-HANDOFF.md](docs/SESSION-HANDOFF.md) | Oturum devri prompt şablonu |
| [docs/adr/](docs/adr/) | Mimari karar kayıtları |
