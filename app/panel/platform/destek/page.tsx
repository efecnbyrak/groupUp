import { Suspense } from "react";

import { ComingSoon } from "@/app/_components/coming-soon";
import { titled } from "@/app/_lib/metadata";

export const generateMetadata = titled("panel.support");

/** Destek (ticket) F5'te. */
export default function PlatformSupportPage() {
  return (
    <Suspense fallback={null}>
      <ComingSoon titleKey="panel.support" />
    </Suspense>
  );
}
