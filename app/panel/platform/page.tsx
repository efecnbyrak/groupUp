import { Hammer } from "lucide-react";
import { Suspense } from "react";

import { PageHeader } from "@/components/shell";
import { EmptyState } from "@/components/ui";
import { getT } from "@/i18n/server";

async function Content() {
  const t = await getT();
  return (
    <>
      <PageHeader title={t("panel.overview")} />
      <EmptyState icon={<Hammer aria-hidden="true" className="size-(--icon-size-lg)" />} title={t("common.comingSoon")} description={t("common.comingSoonBody")} />
    </>
  );
}

export default function PlatformOverviewPage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
