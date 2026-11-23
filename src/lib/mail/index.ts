import "server-only";

import { env } from "../env";
import { ConsoleMailProvider } from "./console";
import { SmtpMailProvider } from "./smtp";
import type { MailProvider } from "./types";

export type { MailMessage, MailProvider } from "./types";

let provider: MailProvider | undefined;

export function getMailProvider(): MailProvider {
  if (provider) return provider;
  switch (env.MAIL_PROVIDER) {
    case "smtp":
      provider = new SmtpMailProvider(env.MAIL_FROM, { host: env.SMTP_HOST, port: env.SMTP_PORT });
      break;
    case "console":
      provider = new ConsoleMailProvider(env.MAIL_FROM);
      break;
    case "ses":
      // AWS SES sağlayıcısı canlıya çıkışta (F12) eklenir.
      throw new Error("MAIL_PROVIDER=ses henüz uygulanmadı (F12)");
  }
  return provider;
}
