import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { titled } from "@/app/_lib/metadata";
import { ActionForm, Alert } from "@/components/ui";
import { getT } from "@/i18n/server";
import { confirmAccountDeletionAction, isDeleteTokenValid } from "@/modules/identity";

import { AuthCard, linkClass } from "../../../_components/auth-card";

export const generateMetadata = titled("account.delete.confirmTitle");

/** Maildeki link → onay düğmesi. GET isteği hiçbir şeyi silmez (link önizleyicileri/tarayıcılar). */
async function Content({ searchParams }: PageProps<"/hesap/sil/onay">) {
  const [t, sp] = await Promise.all([getT(), searchParams]);
  const token = typeof sp.token === "string" ? sp.token : "";
  await connection(); // token süresi "şimdi"ye göre kontrol edilir
  const valid = token.length >= 10 && (await isDeleteTokenValid(token));
  return (
    <AuthCard
      title={t("account.delete.confirmTitle")}
      footer={
        <Link href="/hesap" className={linkClass}>
          {t("account.delete.keep")}
        </Link>
      }
    >
      {valid ? (
        <div className="flex flex-col gap-(--space-4)">
          <Alert tone="warning">{t("account.delete.confirmBody")}</Alert>
          <ActionForm
            action={confirmAccountDeletionAction}
            fields={[{ type: "hidden", name: "token", value: token }]}
            submitLabel={t("account.delete.confirmSubmit")}
            submitVariant="danger"
            loadingLabel={t("common.loading")}
          />
        </div>
      ) : (
        <Alert tone="danger">{t("account.delete.invalidToken")}</Alert>
      )}
    </AuthCard>
  );
}

export default function ConfirmDeletePage(props: PageProps<"/hesap/sil/onay">) {
  return (
    <Suspense fallback={null}>
      <Content {...props} />
    </Suspense>
  );
}
