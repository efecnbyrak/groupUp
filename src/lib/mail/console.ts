import type { MailMessage, MailProvider } from "./types";

/** Test ve mail sunucusu olmayan ortamlar için: gönderilenleri bellekte tutar ve loglar. */
export class ConsoleMailProvider implements MailProvider {
  readonly name = "console";
  readonly sent: (MailMessage & { from: string })[] = [];

  constructor(
    private readonly from: string,
    private readonly log: (line: string) => void = console.info,
  ) {}

  async send(message: MailMessage): Promise<void> {
    this.sent.push({ ...message, from: this.from });
    this.log(`[mail:console] ${this.from} → ${message.to} · ${message.subject}`);
  }
}
