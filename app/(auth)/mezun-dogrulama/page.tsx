import { Clock } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { titled } from "@/app/_lib/metadata";
import { ActionForm, Alert, Button } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { getSessionUser } from "@/lib/authz";
import { formatDateTime } from "@/lib/dates";
import { logoutAction } from "@/modules/identity";
import { getAlumniVerification, uploadAlumniDocumentAction } from "@/modules/profile";

import { AuthCard } from "../_components/auth-card";

export const generateMetadata = titled("alumni.title");

/** Manuel mezun yolu: belge yükleme + bekleme ekranı. Karar F5'te (onay motoru). */
async function Content() {
  const [t, locale, user] = await Promise.all([getT(), getLocale(), getSessionUser()]);
  if (!user) redirect("/giris?next=%2Fmezun-dogrulama");
  if (!user.emailVerified) redirect("/dogrula");
  if (user.status === "ACTIVE") redirect("/akis");
  if (user.status !== "PENDING_ALUMNI_REVIEW") redirect("/giris");
  const verification = await getAlumniVerification(user.id);

  const form = (submitLabel: string) => (
    <ActionForm
      action={uploadAlumniDocumentAction}
      fields={[{ type: "file", name: "document", label: t("alumni.document"), hint: t("alumni.documentHint"), accept: "application/pdf,image/jpeg,image/png", required: true }]}
      submitLabel={submitLabel}
      loadingLabel={t("common.loading")}
    />
  );

  return (
    <AuthCard
      title={t("alumni.title")}
      footer={
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="sm">
            {t("auth.account.logout")}
          </Button>
        </form>
      }
    >
      <div className="flex flex-col gap-(--space-4)">
        {!verification ? (
          <>
            <p className="text-fg-secondary">{t("alumni.intro")}</p>
            {form(t("alumni.submit"))}
          </>
        ) : verification.status === "REJECTED" ? (
          <>
            <Alert tone="danger" title={t("alumni.rejectedTitle")}>
              {verification.rejectReason ?? t("alumni.rejectedBody")}
            </Alert>
            {form(t("alumni.resubmit"))}
          </>
        ) : (
          <>
            <div className="flex items-start gap-(--space-3) rounded-card bg-muted p-(--space-4)">
              <Clock aria-hidden="true" className="mt-(--space-0-5) size-(--icon-size-md) shrink-0 text-brand" />
              <div className="flex flex-col gap-(--space-1)">
                <p className="font-semibold text-fg">{t("alumni.pendingTitle")}</p>
                <p className="text-(length:--type-body-sm) text-fg-secondary">{t("alumni.pendingBody")}</p>
                <p className="text-(length:--type-caption) text-fg-secondary">
                  {t("alumni.submittedFile", { file: verification.fileName, date: formatDateTime(verification.submittedAt, locale) })}
                </p>
              </div>
            </div>
            <details className="flex flex-col gap-(--space-3)">
              <summary className="cursor-pointer text-(length:--type-body-sm) font-semibold text-(--color-link)">{t("alumni.replace")}</summary>
              <div className="pt-(--space-3)">{form(t("alumni.resubmit"))}</div>
            </details>
          </>
        )}
      </div>
    </AuthCard>
  );
}

export default function AlumniVerificationPage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
