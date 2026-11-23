// Kullanım: npm run mail:test [-- alici@ornek.com]
import { getMailProvider } from "../src/lib/mail";

async function main() {
  const to = process.argv[2] ?? "test@ogr.kent.edu.tr";
  const provider = getMailProvider();

  await provider.send({
    to,
    subject: "groupUp test maili",
    text: "groupUp mail altyapısı çalışıyor.",
    html: "<p><strong>groupUp</strong> mail altyapısı çalışıyor.</p>",
  });

  console.info(`[mail:test] ${provider.name} ile gönderildi → ${to}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
