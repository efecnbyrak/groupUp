// Seed — F2'de doldurulacak: Süper Admin, İstanbul Kent Üniversitesi,
// domainler (ogr.kent.edu.tr → STUDENT, mezun.kent.edu.tr → ALUMNI), örnek fakülte/bölüm.
import { db } from "../src/lib/db";

async function main() {
  const [row] = await db.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
  console.info(`[seed] veritabanı bağlantısı tamam (ok=${row?.ok}). Seed verisi F2'de eklenecek.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
