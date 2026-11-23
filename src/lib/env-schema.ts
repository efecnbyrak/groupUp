import { z } from "zod";

/**
 * Ortam değişkenleri şeması (.env.example ile birebir).
 * Saf modül: process.env'e dokunmaz, test edilebilir. Çalışma zamanı değeri: `@/lib/env`.
 */

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).optional());
const secret = z.string().min(32, "en az 32 karakter olmalı (openssl rand -base64 32)");

export const envSchema = z
  .object({
    APP_URL: z.url(),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    SESSION_SECRET: secret,

    DATABASE_URL: z.url(),
    DATABASE_URL_TEST: z.preprocess(emptyToUndefined, z.url().optional()),
    DIRECT_URL: z.preprocess(emptyToUndefined, z.url().optional()),

    SUPERADMIN_EMAIL: z.preprocess(emptyToUndefined, z.email().optional()),
    SUPERADMIN_PASSWORD: optionalString,
    DEMO_PASSWORD: optionalString,

    MAIL_PROVIDER: z.enum(["smtp", "ses", "console"]).default("console"),
    MAIL_FROM: z.string().min(1),
    SMTP_HOST: z.string().min(1).default("localhost"),
    SMTP_PORT: z.coerce.number().int().positive().default(1025),
    AWS_REGION: optionalString,
    AWS_ACCESS_KEY_ID: optionalString,
    AWS_SECRET_ACCESS_KEY: optionalString,

    STORAGE_DRIVER: z.enum(["local", "r2"]).default("local"),
    STORAGE_LOCAL_DIR: z.string().min(1).default("./storage"),
    R2_ACCOUNT_ID: optionalString,
    R2_ACCESS_KEY_ID: optionalString,
    R2_SECRET_ACCESS_KEY: optionalString,
    R2_PUBLIC_BUCKET: optionalString,
    R2_PRIVATE_BUCKET: optionalString,
    R2_PUBLIC_BASE_URL: z.preprocess(emptyToUndefined, z.url().optional()),

    TRANSLATION_PROVIDER: z.enum(["deepl", "none"]).default("none"),
    DEEPL_API_KEY: optionalString,
    DEEPL_API_URL: z.url().default("https://api-free.deepl.com"),

    CRON_SECRET: secret,
  })
  .superRefine((env, ctx) => {
    const requireKeys = (when: string, keys: (keyof typeof env)[]) => {
      for (const key of keys) {
        if (!env[key]) {
          ctx.addIssue({ code: "custom", path: [key], message: `${when} için zorunlu` });
        }
      }
    };
    if (env.MAIL_PROVIDER === "ses") {
      requireKeys("MAIL_PROVIDER=ses", ["AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]);
    }
    if (env.STORAGE_DRIVER === "r2") {
      requireKeys("STORAGE_DRIVER=r2", [
        "R2_ACCOUNT_ID",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_PUBLIC_BUCKET",
        "R2_PRIVATE_BUCKET",
        "R2_PUBLIC_BASE_URL",
      ]);
    }
    if (env.TRANSLATION_PROVIDER === "deepl") {
      requireKeys("TRANSLATION_PROVIDER=deepl", ["DEEPL_API_KEY"]);
    }
  });

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Geçersiz ortam değişkenleri (.env):\n${issues.map((i) => `  - ${i}`).join("\n")}`);
    this.name = "EnvValidationError";
  }
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join(".") || "(kök)"}: ${issue.message}`),
    );
  }
  return result.data;
}
