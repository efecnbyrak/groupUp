import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { titled } from "@/app/_lib/metadata";
import { requirePageUser } from "@/app/_lib/page-user";
import { ActionForm, Alert, Card, Skeleton } from "@/components/ui";
import { getT } from "@/i18n/server";
import { requestAccountDeletionAction } from "@/modules/identity";

export const generateMetadata = titled("account.delete.title");

async function Content() {
  const [t] = await Promise.all([getT(), requirePageUser("/hesap/sil")]);
  return (
    <>
      <Link href="/hesap" className="inline-flex min-h-(--touch-target-min) items-center gap-(--space-1) self-start text-(length:--type-body-sm) font-semibold text-(--color-link) hover:underline">
        <ArrowLeft aria-hidden="true" className="size-(--icon-size-sm)" />
        {t("auth.security.back")}
      </Link>
      <h1 className="font-display text-heading-xl font-semibold text-fg">{t("account.delete.title")}</h1>
      <Card padding="lg" className="flex max-w-(--content-width-md) flex-col gap-(--space-6)">
        <Alert tone="warning" title={t("account.delete.warningTitle")}>
          {t("account.delete.warningBody")}
        </Alert>
        <ActionForm
          action={requestAccountDeletionAction}
          fields={[
            { type: "password", name: "password", label: t("auth.fields.password"), required: true, autoComplete: "current-password" },
            { type: "checkbox", name: "confirm", label: t("account.delete.confirmLabel") },
          ]}
          submitLabel={t("account.delete.submit")}
          submitVariant="danger"
          loadingLabel={t("common.loading")}
          resetOnSuccess
        />
      </Card>
    </>
  );
}

export default function DeleteAccountPage() {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content />
    </Suspense>
  );
}
