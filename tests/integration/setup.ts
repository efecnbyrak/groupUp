// Entegrasyon testleri: groupup_test veritabanı + bellekte mail. `@/lib/env` import edilmeden önce çalışır.
import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");
if (!process.env.DATABASE_URL_TEST) throw new Error("DATABASE_URL_TEST tanımlı değil — entegrasyon testleri çalışamaz");
if (process.env.DATABASE_URL_TEST === process.env.DATABASE_URL) throw new Error("DATABASE_URL_TEST, DATABASE_URL ile aynı olamaz");
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.MAIL_PROVIDER = "console";
