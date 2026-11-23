import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { getT } from "@/i18n/server";
import { isResetTokenValid, labelsFor, RESET_KEYS, ResetPasswordForm } from "@/modules/identity";

import { AuthCard, linkClass } from "../_components/auth-card";

export const metadata = { title: "Şifre sıfırla — groupUp" };

async function ResetContent({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  await connection(); // token kontrolü istek anında (new Date) yapılır
  const [t, params] = await Promise.all([getT(), searchParams]);
  const token = typeof params.token === "string" ? params.token : "";
  const valid = token.length >= 10 && token.length <= 200 && (await isResetTokenValid(token));
  return (
    <AuthCard title={t("auth.reset.title")}>
      {valid ? (
        <ResetPasswordForm labels={labelsFor(t, RESET_KEYS)} token={token} />
      ) : (
        <>
          <p role="alert" className="text-fg-secondary">
            {t("auth.reset.invalidToken")}
          </p>
          <Link href="/sifremi-unuttum" className={`mt-(--space-4) inline-block ${linkClass}`}>
            {t("auth.forgot.title")}
          </Link>
        </>
      )}
    </AuthCard>
  );
}

export default function ResetPasswordPage(props: PageProps<"/sifre-sifirla">) {
  return (
    <Suspense fallback={null}>
      <ResetContent searchParams={props.searchParams as Promise<{ token?: string }>} />
    </Suspense>
  );
}
