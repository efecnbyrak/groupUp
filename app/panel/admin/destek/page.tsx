import { Suspense } from "react";

import { ComingSoon } from "@/app/_components/coming-soon";
import { titled } from "@/app/_lib/metadata";

export const generateMetadata = titled("panel.support");

/** F5 (ticket) fazında doldurulur. */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ComingSoon titleKey="panel.support" />
    </Suspense>
  );
}
