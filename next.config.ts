import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Dosya yüklemeleri Server Action ile (mezun belgesi ≤ 10 MB, avatar ≤ 5 MB).
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
  serverExternalPackages: ["sharp"],
};

export default withNextIntl(nextConfig);
