import Link from "next/link";
import { Suspense } from "react";

import { getT } from "@/i18n/server";
import { getPendingVerification, labelsFor, OtpForm, VERIFY_KEYS } from "@/modules/identity";

import { AuthCard, linkClass } from "../_components/auth-card";

export const metadata = { title: "E-posta doğrulama — groupUp" };

async function VerifyContent({ searchParams }: { searchParams: Promise<{ hata?: string }> }) {
  const [t, email, params] = await Promise.all([getT(), getPendingVerification(), searchParams]);
  if (!email) {
    return (
      <AuthCard title={t("auth.verify.title")}>
        <p className="text-fg-secondary">{t("auth.verify.noPending")}</p>
        <p className="mt-(--space-4) flex gap-(--space-4)">
          <Link href="/giris" className={linkClass}>
            {t("auth.login.title")}
          </Link>
          <Link href="/kayit" className={linkClass}>
            {t("auth.register.title")}
          </Link>
        </p>
      </AuthCard>
    );
  }
  return (
    <AuthCard title={t("auth.verify.title")} subtitle={t("auth.verify.subtitle", { email })}>
      <OtpForm labels={labelsFor(t, VERIFY_KEYS)} initialError={params.hata === "mail" ? t("errors.mailFailed") : undefined} />
    </AuthCard>
  );
}

export default function VerifyPage(props: PageProps<"/dogrula">) {
  return (
    <Suspense fallback={null}>
      <VerifyContent searchParams={props.searchParams as Promise<{ hata?: string }>} />
    </Suspense>
  );
}
