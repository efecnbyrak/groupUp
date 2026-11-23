import { Suspense } from "react";

import { ComingSoon } from "@/app/_components/coming-soon";
import { titled } from "@/app/_lib/metadata";

export const generateMetadata = titled("admin.nav.elections");

/** F11 fazında doldurulur. */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ComingSoon titleKey="admin.nav.elections" />
    </Suspense>
  );
}
