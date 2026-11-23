import Link from "next/link";
import { Suspense } from "react";

import { titled } from "@/app/_lib/metadata";
import { getT } from "@/i18n/server";
import { FORGOT_KEYS, ForgotPasswordForm, labelsFor } from "@/modules/identity";

import { AuthCard, linkClass } from "../_components/auth-card";

export const generateMetadata = titled("auth.forgot.title");

async function ForgotContent() {
  const t = await getT();
  return (
    <AuthCard
      title={t("auth.forgot.title")}
      subtitle={t("auth.forgot.subtitle")}
      footer={
        <Link href="/giris" className={linkClass}>
          {t("auth.forgot.backToLogin")}
        </Link>
      }
    >
      <ForgotPasswordForm labels={labelsFor(t, FORGOT_KEYS)} />
    </AuthCard>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotContent />
    </Suspense>
  );
}
