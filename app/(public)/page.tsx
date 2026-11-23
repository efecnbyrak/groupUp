import { Suspense } from "react";

import { Landing } from "@/components/marketing";
import { getLocale, getT } from "@/i18n/server";

async function Content() {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  return <Landing t={t} locale={locale} />;
}

/** Giriş yapmamış ana sayfa. Oturum cookie'si varsa proxy `/akis`'e yönlendirir. */
export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
