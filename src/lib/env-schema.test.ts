import { describe, expect, it } from "vitest";

import { EnvValidationError, parseEnv } from "./env-schema";

const valid = {
  APP_URL: "http://localhost:3000",
  NODE_ENV: "development",
  SESSION_SECRET: "a".repeat(32),
  DATABASE_URL: "postgresql://groupup:groupup_dev@localhost:5432/groupup",
  MAIL_PROVIDER: "smtp",
  MAIL_FROM: "groupUp <no-reply@groupup.local>",
  SMTP_HOST: "localhost",
  SMTP_PORT: "1025",
  STORAGE_DRIVER: "local",
  TRANSLATION_PROVIDER: "none",
  CRON_SECRET: "b".repeat(32),
  SUPERADMIN_EMAIL: "",
  AWS_ACCESS_KEY_ID: "",
};

describe("parseEnv", () => {
  it("geçerli değerleri ayrıştırır ve sayıya çevirir", () => {
    const env = parseEnv(valid);
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.STORAGE_LOCAL_DIR).toBe("./storage");
  });

  it("boş string'i tanımsız sayar", () => {
    const env = parseEnv(valid);
    expect(env.SUPERADMIN_EMAIL).toBeUndefined();
    expect(env.DEMO_PASSWORD).toBeUndefined();
    expect(parseEnv({ ...valid, DEMO_PASSWORD: "Demo!1234" }).DEMO_PASSWORD).toBe("Demo!1234");
    expect(env.AWS_ACCESS_KEY_ID).toBeUndefined();
  });

  it("eksik zorunlu değişkende anlaşılır hata verir", () => {
    const { DATABASE_URL: _omit, ...rest } = valid;
    expect(() => parseEnv(rest)).toThrow(EnvValidationError);
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it("kısa secret'ı reddeder", () => {
    expect(() => parseEnv({ ...valid, SESSION_SECRET: "kisa" })).toThrow(/SESSION_SECRET/);
  });

  it("seçilen sağlayıcının anahtarlarını zorunlu kılar", () => {
    expect(() => parseEnv({ ...valid, MAIL_PROVIDER: "ses" })).toThrow(/AWS_REGION/);
    expect(() => parseEnv({ ...valid, STORAGE_DRIVER: "r2" })).toThrow(/R2_ACCOUNT_ID/);
    expect(() => parseEnv({ ...valid, TRANSLATION_PROVIDER: "deepl" })).toThrow(/DEEPL_API_KEY/);
  });

  it("sağlayıcı anahtarları verilince kabul eder", () => {
    const env = parseEnv({ ...valid, TRANSLATION_PROVIDER: "deepl", DEEPL_API_KEY: "key" });
    expect(env.TRANSLATION_PROVIDER).toBe("deepl");
  });
});
