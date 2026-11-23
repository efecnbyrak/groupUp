import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getT } from "@/i18n/server";
import { getSessionUser } from "@/lib/authz";
import { labelsFor, LOGIN_KEYS, LoginForm } from "@/modules/identity";

import { AuthCard, linkClass } from "../_components/auth-card";

export const metadata = { title: "Giriş yap — groupUp" };

type Params = { next?: string; sifirlandi?: string };

async function LoginContent({ searchParams }: { searchParams: Promise<Params> }) {
  const [t, user, params] = await Promise.all([getT(), getSessionUser(), searchParams]);
  if (user && user.status === "ACTIVE" && user.emailVerified) redirect("/hesap");
  return (
    <AuthCard
      title={t("auth.login.title")}
      footer={
        <div className="flex flex-col gap-(--space-2)">
          <Link href="/sifremi-unuttum" className={linkClass}>
            {t("auth.login.forgot")}
          </Link>
          <span>
            {t("auth.login.noAccount")}{" "}
            <Link href="/kayit" className={linkClass}>
              {t("auth.login.register")}
            </Link>
          </span>
        </div>
      }
    >
      {params.sifirlandi ? (
        <p role="status" className="mb-(--space-4) rounded-control bg-(--color-success-subtle) p-(--space-3) text-(length:--type-body-sm)">
          {t("auth.reset.done")}
        </p>
      ) : null}
      <LoginForm labels={labelsFor(t, LOGIN_KEYS)} next={typeof params.next === "string" ? params.next : undefined} />
    </AuthCard>
  );
}

export default function LoginPage(props: PageProps<"/giris">) {
  return (
    <Suspense fallback={null}>
      <LoginContent searchParams={props.searchParams as Promise<Params>} />
    </Suspense>
  );
}
