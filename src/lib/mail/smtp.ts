import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import type { MailMessage, MailProvider } from "./types";

/** Lokal geliştirme: Mailpit (SMTP 1025, arayüz http://localhost:8025). */
export class SmtpMailProvider implements MailProvider {
  readonly name = "smtp";
  private readonly transporter: Transporter;

  constructor(
    private readonly from: string,
    options: { host: string; port: number },
  ) {
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: false,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({ from: this.from, ...message });
  }
}
