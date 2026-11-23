# Lokal Kurulum

## 1. Mevcut ortam (2026-11-23 itibarıyla doğrulandı)
| Araç | Durum |
|---|---|
| Node.js | 24.18 ✅ |
| npm | 11.16 ✅ |
| PostgreSQL | 19 **kurulu ve çalışıyor** ✅ (systemd `postgresql` active) |
| Docker + Compose | 29 / v5 ✅ (Mailpit için) |
| git / gh | 2.53 / 2.46 ✅ |
| Redis | ❌ kurulmadı — **gerekmiyor** |
| Vercel | ❌ hesap yok — canlıya çıkışta ([DEPLOYMENT.md](DEPLOYMENT.md)) |

## 2. Veritabanı (bir kez)
```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE groupup WITH LOGIN PASSWORD 'groupup_dev' CREATEDB;   -- CREATEDB: prisma shadow DB için
CREATE DATABASE groupup OWNER groupup;
SQL
sudo -u postgres psql -d groupup -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm;'
```
`.env`: `DATABASE_URL="postgresql://groupup:groupup_dev@localhost:5432/groupup"`
Test DB: `groupup_test` (aynı komutla) → `DATABASE_URL_TEST`.

## 3. Mail (Mailpit)
`docker-compose.yml` (F1'de oluşturulur):
```yaml
services:
  mailpit:
    image: axllent/mailpit:latest
    ports: ["1025:1025", "8025:8025"]
    restart: unless-stopped
```
```bash
docker compose up -d
# Gönderilen tüm mailler: http://localhost:8025
```

## 4. Ortam değişkenleri
```bash
cp .env.example .env
openssl rand -base64 32   # SESSION_SECRET ve CRON_SECRET için
```
Değişkenler ve açıklamaları `.env.example` içinde. `src/lib/env.ts` eksik/yanlış değişkende uygulamayı açılışta durdurur.

## 5. Proje (F1 sonrası)
```bash
npm install
npm run db:migrate      # migration'ları uygula
npm run db:seed         # Süper Admin + İstanbul Kent Üniversitesi + kategoriler
npm run db:seed-demo    # (opsiyonel) demo kulüp/etkinlik/turnuva
npm run dev             # http://localhost:3000
```
Mobil cihazdan lokal test: `npm run dev -- --hostname 0.0.0.0` → `http://<bilgisayar-ip>:3000`.

## 6. Git ve GitHub
- Repo `main` dalı ile başlatıldı (`git init -b main`).
- GitHub'da boş repo oluşturun (README/.gitignore **eklemeden**) ve URL'yi Claude'a verin:
```bash
git remote add origin git@github.com:<kullanici>/groupUp.git
git push -u origin main
```
- Dal stratejisi (tek geliştirici): `main` her zaman çalışır durumda; her faz için `feat/f<n>-<ad>` dalı → bitince `main`'e merge.
- **Asla commitlenmez:** `.env`, `storage/`, `node_modules/`.

## 7. Sık sorunlar
| Sorun | Çözüm |
|---|---|
| `P1001 Can't reach database` | `systemctl status postgresql`, `DATABASE_URL` portu (5432) |
| `permission denied to create database` (migrate dev) | rolde `CREATEDB` olmalı |
| Mail gelmiyor | `docker compose ps`, `MAIL_PROVIDER=smtp`, `SMTP_PORT=1025` |
| `sharp` kurulum hatası | `npm rebuild sharp` |
