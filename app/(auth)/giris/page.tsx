import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { titled } from "@/app/_lib/metadata";
import { Alert } from "@/components/ui";
import { getT } from "@/i18n/server";
import { getSessionUser } from "@/lib/authz";
import { labelsFor, LOGIN_KEYS, LoginForm } from "@/modules/identity";

import { AuthCard, linkClass } from "../_components/auth-card";

export const generateMetadata = titled("auth.login.title");

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
        <Alert tone="success" className="mb-(--space-4)">
          {t("auth.reset.done")}
        </Alert>
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
