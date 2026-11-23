import Link from "next/link";
import { Suspense } from "react";

import { getT } from "@/i18n/server";
import { labelsFor, REGISTER_KEYS, RegisterForm } from "@/modules/identity";
import { requestUniversityAction } from "@/modules/university";

import { AuthCard, linkClass } from "../_components/auth-card";

export const metadata = { title: "Kayıt ol — groupUp" };

async function RegisterContent() {
  const t = await getT();
  return (
    <AuthCard
      title={t("auth.register.title")}
      subtitle={t("auth.register.subtitle")}
      footer={
        <>
          {t("auth.register.haveAccount")}{" "}
          <Link href="/giris" className={linkClass}>
            {t("auth.register.login")}
          </Link>
        </>
      }
    >
      <RegisterForm labels={labelsFor(t, REGISTER_KEYS)} requestUniversity={requestUniversityAction} />
    </AuthCard>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterContent />
    </Suspense>
  );
}
