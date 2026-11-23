import { Suspense } from "react";

import { ComingSoon } from "@/app/_components/coming-soon";
import { titled } from "@/app/_lib/metadata";
import { requirePageUser } from "@/app/_lib/page-user";

export const generateMetadata = titled("nav.home");

async function Content() {
  await requirePageUser("/akis");
  return <ComingSoon titleKey="nav.home" />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
