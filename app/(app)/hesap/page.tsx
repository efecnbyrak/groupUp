import Link from "next/link";
import { Suspense } from "react";

import { getT } from "@/i18n/server";
import { logoutAction, logoutAllAction } from "@/modules/identity";

import { requirePageUser } from "./current-user";

export const metadata = { title: "Hesabım — groupUp" };

const buttonClass = "h-(--control-height-md) rounded-control border border-line px-(--space-4) font-semibold text-fg hover:bg-muted";

async function AccountContent() {
  const [t, user] = await Promise.all([getT(), requirePageUser("/hesap")]);
  return (
    <>
      <h1 className="font-display text-heading-xl font-semibold text-fg">{t("auth.account.title")}</h1>
      <p className="text-fg-secondary">{t("auth.account.signedInAs", { email: user.email })}</p>
      <Link href="/hesap/guvenlik" className="text-(--color-link) underline">
        {t("auth.account.security")}
      </Link>
      <div className="flex flex-wrap gap-(--space-3)">
        <form action={logoutAction}>
          <button type="submit" className={buttonClass}>
            {t("auth.account.logout")}
          </button>
        </form>
        <form action={logoutAllAction}>
          <button type="submit" className={buttonClass}>
            {t("auth.account.logoutAll")}
          </button>
        </form>
      </div>
    </>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountContent />
    </Suspense>
  );
}
