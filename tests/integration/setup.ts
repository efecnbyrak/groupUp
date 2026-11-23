// Entegrasyon testleri: groupup_test veritabanı + bellekte mail. `@/lib/env` import edilmeden önce çalışır.
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (existsSync(".env")) process.loadEnvFile(".env");
if (!process.env.DATABASE_URL_TEST) throw new Error("DATABASE_URL_TEST tanımlı değil — entegrasyon testleri çalışamaz");
if (process.env.DATABASE_URL_TEST === process.env.DATABASE_URL) throw new Error("DATABASE_URL_TEST, DATABASE_URL ile aynı olamaz");
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.MAIL_PROVIDER = "console";
// Test dosyaları geçici dizine yazılır (geliştirme ./storage'ına dokunulmaz).
process.env.STORAGE_DRIVER = "local";
process.env.STORAGE_LOCAL_DIR = join(tmpdir(), "groupup-test-storage");
