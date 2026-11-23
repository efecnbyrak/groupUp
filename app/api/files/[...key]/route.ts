import { getStorage, isSafeKey } from "@/lib/storage";

/**
 * Public dosyalar (avatar, logo, etkinlik görselleri) — yalnızca lokal driver'da kullanılır;
 * canlıda R2 public URL'i doğrudan verilir. Anahtarlar tahmin edilemez ve değişmez → immutable cache.
 * Kimlik doğrulama gerekmez (public içerik); authz kuralı bu route için bilerek uygulanmaz.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/files/[...key]">) {
  const { key: parts } = await ctx.params;
  const key = parts.join("/");
  if (!isSafeKey(key)) return new Response(null, { status: 404 });
  const file = await getStorage().get(key, "public");
  if (!file) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
