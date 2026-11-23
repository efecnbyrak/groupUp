import { Hammer } from "lucide-react";

import { EmptyState } from "@/components/ui";
import { getT } from "@/i18n/server";
import type { MessageKey } from "@/i18n/messages";

/** Henüz yapılmamış sayfalar için yer tutucu (ilgili fazda değişir). */
export async function ComingSoon({ titleKey }: { titleKey: MessageKey }) {
  const t = await getT();
  return (
    <>
      <h1 className="text-(length:--type-heading-xl) font-semibold text-fg">{t(titleKey)}</h1>
      <EmptyState icon={<Hammer aria-hidden="true" className="size-(--icon-size-lg)" />} title={t("common.comingSoon")} description={t("common.comingSoonBody")} />
    </>
  );
}
