import { connection } from "next/server";

import { env } from "@/lib/env";
import { getStorage, isSafeKey, verifyFileSignature } from "@/lib/storage";

/**
 * Private dosyalar (mezun belgeleri, kanıtlar): yalnızca imzalı ve süresi dolmamış adresle.
 * Yetki kontrolü imzalı adresi ÜRETEN yerde yapılır (ör. Admin onay ekranı); burada imza doğrulanır.
 */
export async function GET(req: Request) {
  await connection();
  const url = new URL(req.url);
  const key = url.searchParams.get("key") ?? "";
  const exp = Number(url.searchParams.get("exp"));
  const sig = url.searchParams.get("sig") ?? "";
  if (!isSafeKey(key) || !verifyFileSignature(env.SESSION_SECRET, key, exp, sig, Math.floor(Date.now() / 1000))) {
    return new Response(null, { status: 403 });
  }
  const file = await getStorage().get(key, "private");
  if (!file) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
