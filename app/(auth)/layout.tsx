import { Suspense } from "react";

import { Footer, PublicHeader, PublicHeaderFallback, SkipLink } from "@/components/shell";

/** Auth sayfaları: Editorial arketip, ortalanmış kart (DESIGN §1). */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div data-archetype="editorial" className="flex flex-1 flex-col">
      <Suspense fallback={null}>
        <SkipLink />
      </Suspense>
      <Suspense fallback={<PublicHeaderFallback />}>
        <PublicHeader />
      </Suspense>
      <main id="icerik" className="flex flex-1 items-start justify-center bg-canvas-subtle px-(--gutter) py-(--space-12) sm:py-(--space-16)">
        {children}
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
