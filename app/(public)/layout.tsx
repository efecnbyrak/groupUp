import { Suspense } from "react";

import { Footer, PublicHeader, PublicHeaderFallback, SkipLink } from "@/components/shell";

/** Giriş yapmamış sayfalar: Editorial arketip, ince header + directory footer. */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div data-archetype="editorial" className="flex flex-1 flex-col">
      <Suspense fallback={null}>
        <SkipLink />
      </Suspense>
      <Suspense fallback={<PublicHeaderFallback />}>
        <PublicHeader />
      </Suspense>
      <main id="icerik" className="flex flex-1 flex-col">
        {children}
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
