import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { titled } from "@/app/_lib/metadata";
import { requirePageUser } from "@/app/_lib/page-user";
import { Card } from "@/components/ui";
import { getT } from "@/i18n/server";
import { ChangeEmailForm, ChangePasswordForm, labelsFor, SECURITY_KEYS } from "@/modules/identity";

export const generateMetadata = titled("auth.security.title");


async function SecurityContent() {
  const [t] = await Promise.all([getT(), requirePageUser("/hesap/guvenlik")]);
  const labels = labelsFor(t, SECURITY_KEYS);
  return (
    <>
      <Link href="/hesap" className="inline-flex min-h-(--touch-target-min) items-center gap-(--space-1) self-start text-(length:--type-body-sm) font-semibold text-(--color-link) hover:underline">
        <ArrowLeft aria-hidden="true" className="size-(--icon-size-sm)" />
        {t("auth.security.back")}
      </Link>
      <h1 className="font-display text-heading-xl font-semibold text-fg">{t("auth.security.title")}</h1>
      <Card padding="lg" className="flex flex-col gap-(--space-6)" aria-labelledby="change-password" role="region">
        <h2 id="change-password" className="text-(length:--type-heading-md) font-semibold text-fg">
          {t("auth.security.changePassword")}
        </h2>
        <div className="max-w-(--content-width-sm)">
          <ChangePasswordForm labels={labels} />
        </div>
      </Card>
      <Card padding="lg" className="flex flex-col gap-(--space-6)" aria-labelledby="change-email" role="region">
        <h2 id="change-email" className="text-(length:--type-heading-md) font-semibold text-fg">
          {t("auth.security.changeEmail")}
        </h2>
        <div className="max-w-(--content-width-sm)">
          <ChangeEmailForm labels={labels} />
        </div>
      </Card>
    </>
  );
}

export default function SecurityPage() {
  return (
    <Suspense fallback={null}>
      <SecurityContent />
    </Suspense>
  );
}
