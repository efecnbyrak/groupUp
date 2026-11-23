import { Suspense } from "react";

import { ComingSoon } from "@/app/_components/coming-soon";
import { titled } from "@/app/_lib/metadata";
import { requirePageUser } from "@/app/_lib/page-user";

export const generateMetadata = titled("nav.clubs");

async function Content() {
  await requirePageUser("/kulupler");
  return <ComingSoon titleKey="nav.clubs" />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
