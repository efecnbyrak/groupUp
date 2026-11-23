import { NextResponse, type NextRequest } from "next/server";

/**
 * Yalnızca iyimser yönlendirme (AUTH-EMAIL §4): korunan sayfalarda `gu_session` cookie'si
 * yoksa girişe gönderir. Asıl doğrulama sunucuda `requireUser()` / sayfa kapısında yapılır.
 * Auth sayfalarından geri yönlendirme yok (bayat cookie ile döngüyü önlemek için).
 */
const SESSION_COOKIE = "gu_session";

export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/giris";
  url.search = "";
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/hesap/:path*", "/panel/:path*"],
};
