import { NextResponse, type NextRequest } from "next/server";

/**
 * Yalnızca iyimser yönlendirme (AUTH-EMAIL §4): korunan sayfalarda `gu_session` cookie'si
 * yoksa girişe gönderir; varsa `/` (landing) yerine akışa (`/akis`) gönderir.
 * Asıl doğrulama sunucuda `requireUser()` / sayfa kapısında yapılır. Bayat cookie döngü
 * yapmaz: `/akis` geçersiz oturumda `/giris`'e yönlendirir, oradan geri yönlendirme yok.
 */
const SESSION_COOKIE = "gu_session";
/** Maildeki tek kullanımlık linkler: oturum gerekmez (token kanıttır). */
const PUBLIC_UNDER_PROTECTED = ["/hesap/sil/onay"];

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const { pathname, search } = request.nextUrl;
  const url = request.nextUrl.clone();
  url.search = "";

  if (pathname === "/") {
    if (!hasSession) return NextResponse.next();
    url.pathname = "/akis";
    return NextResponse.redirect(url);
  }
  if (hasSession || PUBLIC_UNDER_PROTECTED.includes(pathname)) return NextResponse.next();
  url.pathname = "/giris";
  url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/", "/akis", "/kesfet", "/kulupler", "/etkinliklerim", "/hesap/:path*", "/profil/:path*", "/mezun-dogrulama", "/panel/:path*"],
};
