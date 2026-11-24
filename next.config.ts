import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isProd = process.env.NODE_ENV === "production";
const appOrigin = (() => {
  try {
    return process.env.APP_URL ? new URL(process.env.APP_URL).origin : undefined;
  } catch {
    return undefined;
  }
})();
const r2PublicOrigin = (() => {
  try {
    return process.env.R2_PUBLIC_BASE_URL ? new URL(process.env.R2_PUBLIC_BASE_URL).origin : undefined;
  } catch {
    return undefined;
  }
})();

/**
 * CSP: tüm statik/arka plan görseller aynı kökten gelir (lokalde /api/files,
 * canlıda R2_PUBLIC_BASE_URL). next/font kendi barındırır → font-src 'self' yeterli.
 * script-src 'unsafe-inline' prod'da da gerekli: Next App Router kendi hydration/flight
 * verisini sayfaya inline <script> ile basar (nonce'suz); bunsuz uygulama hiç hydrate
 * olmaz (tüm e2e'de "element not visible" sonsuz retry olarak görüldü — F12.2 notu).
 * Harici script kaynağı yine de yalnızca 'self' — XSS ile üçüncü taraf script yüklenemez.
 */
const csp = [
  "default-src 'self'",
  `img-src 'self' data: blob:${r2PublicOrigin ? ` ${r2PublicOrigin}` : ""}`,
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  `connect-src 'self'${isProd ? "" : " ws:"}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProd && appOrigin?.startsWith("https://") ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Dosya yüklemeleri Server Action ile (mezun belgesi ≤ 10 MB, avatar ≤ 5 MB).
  experimental: {
    serverActions: {
      bodySizeLimit: "11mb",
      // Origin başlığı Host'tan farklı olabilir (ör. reverse proxy); canlı domain burada beyaz listelenir.
      ...(appOrigin ? { allowedOrigins: [appOrigin.replace(/^https?:\/\//, "")] } : {}),
    },
  },
  serverExternalPackages: ["sharp"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
