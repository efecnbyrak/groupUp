import { Suspense } from "react";

import { ComingSoon } from "@/app/_components/coming-soon";

// KVKK / gizlilik / kullanım şartları / iletişim metinleri F12'de gelir.
export default function LegalPage() {
  return (
    <div className="mx-auto flex w-full max-w-(--content-width-md) flex-col gap-(--space-6) px-(--gutter) py-(--space-12)">
      <Suspense fallback={null}>
        <ComingSoon titleKey="footer.legal" />
      </Suspense>
    </div>
  );
}

export function generateStaticParams() {
  return [{ slug: "kvkk" }, { slug: "gizlilik" }, { slug: "kullanim-sartlari" }, { slug: "iletisim" }];
}
