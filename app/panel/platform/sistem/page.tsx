import { Suspense } from "react";

import { ComingSoon } from "@/app/_components/coming-soon";
import { titled } from "@/app/_lib/metadata";

export const generateMetadata = titled("panel.systemStatus");

/** Sistem durumu F12'de (sağlık kontrolleri, cron son çalışma zamanları). */
export default function PlatformSystemPage() {
  return (
    <Suspense fallback={null}>
      <ComingSoon titleKey="panel.systemStatus" />
    </Suspense>
  );
}
